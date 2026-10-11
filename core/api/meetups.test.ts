import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelMeetup,
  loadConversationMeetup,
  proposeMeetup,
  respondToMeetup,
  subscribeToMeetup,
} from "./meetups";

/**
 * core/api test kalıbı (README "Test kalıbı ve yüklenebilirlik"):
 * - `./supabase.client` mock'lanır: gerçek Supabase istemcisi / ağ yok.
 *   `requireSupabaseClient()` her testte elle kurulan sahteyi döner.
 * - `./observability` mock'lanır: analytics yalnız çağrı olarak gözlenir.
 *   (`meetups.ts` yalnız bu iki modülü import eder.)
 * - Mock'lar `vi.hoisted` ile tanımlanır, her testte `beforeEach` ile sıfırlanır.
 *
 * Sunucu kuralları (yalnız doğrulanmış yer, yanıtı karşı taraf verir, sohbette
 * tek canlı buluşma) `supabase/tests/meetups.test.sql`'de kilitli; bu dosya
 * yalnız istemci eşlemesini ve RPC/olay sözleşmesini kilitler.
 */
const mocks = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn(),
  trackProductEvent: vi.fn(),
}));

vi.mock("./supabase.client", () => ({
  requireSupabaseClient: mocks.requireSupabaseClient,
}));
vi.mock("./observability", () => ({
  trackProductEvent: mocks.trackProductEvent,
}));

const rpcRow = {
  id: "meetup-1",
  place_id: "place-1",
  place_name: "Moda Parkı",
  place_note: "Giriş kapısı yanı",
  verification_method: "official_source",
  source_name: "Belediye",
  source_url: "https://example.org/park",
  source_checked_at: "2026-10-01T09:00:00Z",
  amenities: ["water", "fenced"],
  scheduled_at: "2026-10-10T12:00:00Z",
  status: "proposed",
  mine: true,
  // Sunucu satırında olabilir ama istemci çıktısına geçmemeli.
  proposed_by: "user-1",
};

function buildRpcClient(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  mocks.requireSupabaseClient.mockReturnValue({ rpc });
  return { rpc };
}

beforeEach(() => {
  mocks.requireSupabaseClient.mockReset();
  mocks.trackProductEvent.mockReset();
});

describe("loadConversationMeetup", () => {
  it("conversation_meetup RPC'sini p_conversation_id ile çağırır", async () => {
    const { rpc } = buildRpcClient({ data: [rpcRow], error: null });

    await loadConversationMeetup("conv-1");

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("conversation_meetup", {
      p_conversation_id: "conv-1",
    });
  });

  it("snake_case satırı camelCase'e eşler; proposed_by çıktıda yok", async () => {
    buildRpcClient({ data: [rpcRow], error: null });

    const result = await loadConversationMeetup("conv-1");

    expect(result).toEqual({
      id: "meetup-1",
      placeId: "place-1",
      placeName: "Moda Parkı",
      placeNote: "Giriş kapısı yanı",
      verificationMethod: "official_source",
      sourceName: "Belediye",
      sourceUrl: "https://example.org/park",
      sourceCheckedAt: "2026-10-01T09:00:00Z",
      amenities: ["water", "fenced"],
      scheduledAt: "2026-10-10T12:00:00Z",
      status: "proposed",
      mine: true,
    });
    expect(result).not.toHaveProperty("proposed_by");
    expect(result).not.toHaveProperty("proposedBy");
  });

  it("amenities null ise boş diziye düşer", async () => {
    buildRpcClient({ data: [{ ...rpcRow, amenities: null }], error: null });

    const result = await loadConversationMeetup("conv-1");

    expect(result?.amenities).toEqual([]);
  });

  it("opsiyonel alanlar null gelirse null kalır", async () => {
    buildRpcClient({
      data: [
        {
          ...rpcRow,
          place_note: null,
          verification_method: null,
          source_name: null,
          source_url: null,
          source_checked_at: null,
          mine: false,
          status: "accepted",
        },
      ],
      error: null,
    });

    const result = await loadConversationMeetup("conv-1");

    expect(result).toMatchObject({
      placeNote: null,
      verificationMethod: null,
      sourceName: null,
      sourceUrl: null,
      sourceCheckedAt: null,
      mine: false,
      status: "accepted",
    });
  });

  it.each([
    ["null", null],
    ["boş dizi", []],
  ])("data %s ise null döner", async (_ad, data) => {
    buildRpcClient({ data, error: null });

    await expect(loadConversationMeetup("conv-1")).resolves.toBeNull();
  });

  it("iki satır gelirse yalnız ilki eşlenir", async () => {
    // Gizli bağ: `conversation_meetup` son tanımı (0052_meetup_place_source_
    // verification.sql:98-133) yalnız `proposed|accepted` satırları ve en yeni
    // 1 satırı döndürür; istemci `data?.[0]` ile buna dayanır.
    buildRpcClient({
      data: [rpcRow, { ...rpcRow, id: "meetup-2", status: "accepted" }],
      error: null,
    });

    const result = await loadConversationMeetup("conv-1");

    expect(result?.id).toBe("meetup-1");
    expect(result?.status).toBe("proposed");
  });

  it("RPC hatası aynen fırlatılır", async () => {
    const error = new Error("rpc failed");
    buildRpcClient({ data: null, error });

    await expect(loadConversationMeetup("conv-1")).rejects.toBe(error);
  });
});

/**
 * Gizli bağ: olay adları `product_events_event_name_check` listesine bağlı
 * (son tanım 0051_match_moment_observability.sql:2-27; tip observability.ts
 * :25-28). Ad yanlışsa sunucu satırı reddeder, istemci yalnız `console.warn`
 * yapar (observability.ts:41-45) -> sessiz kayıp. Bu yüzden dört ad birebir
 * kilitli: meetup_proposed, meetup_accepted, meetup_declined, meetup_cancelled.
 */
describe("proposeMeetup", () => {
  const scheduledAt = new Date("2026-10-10T15:00:00+03:00");

  it("propose_meetup RPC'sini ISO (UTC) tarihle çağırır", async () => {
    // RPC son tanımı: 0043_meetups.sql:77-81.
    const { rpc } = buildRpcClient({ data: "meetup-9", error: null });

    await proposeMeetup({
      conversationId: "conv-1",
      placeId: "place-1",
      scheduledAt,
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("propose_meetup", {
      p_conversation_id: "conv-1",
      p_place_id: "place-1",
      p_scheduled_at: "2026-10-10T12:00:00.000Z",
    });
  });

  it("başarıda data döner ve meetup_proposed olayı bir kez, ek parametresiz gider", async () => {
    buildRpcClient({ data: "meetup-9", error: null });

    const result = await proposeMeetup({
      conversationId: "conv-1",
      placeId: "place-1",
      scheduledAt,
    });

    expect(result).toBe("meetup-9");
    expect(mocks.trackProductEvent).toHaveBeenCalledTimes(1);
    expect(mocks.trackProductEvent).toHaveBeenCalledWith("meetup_proposed");
  });

  it("hatada fırlatır ve olay çağrılmaz", async () => {
    const error = new Error("propose failed");
    buildRpcClient({ data: null, error });

    await expect(
      proposeMeetup({ conversationId: "conv-1", placeId: "place-1", scheduledAt }),
    ).rejects.toBe(error);
    expect(mocks.trackProductEvent).not.toHaveBeenCalled();
  });
});

describe("respondToMeetup", () => {
  it("kabul: respond_to_meetup(p_accept: true) + meetup_accepted", async () => {
    // RPC son tanımı: 0043_meetups.sql:132-135.
    const { rpc } = buildRpcClient({ data: null, error: null });

    await expect(respondToMeetup("meetup-1", true)).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("respond_to_meetup", {
      p_meetup_id: "meetup-1",
      p_accept: true,
    });
    expect(mocks.trackProductEvent).toHaveBeenCalledTimes(1);
    expect(mocks.trackProductEvent).toHaveBeenCalledWith("meetup_accepted");
  });

  it("ret: respond_to_meetup(p_accept: false) + meetup_declined", async () => {
    const { rpc } = buildRpcClient({ data: null, error: null });

    await respondToMeetup("meetup-1", false);

    expect(rpc).toHaveBeenCalledWith("respond_to_meetup", {
      p_meetup_id: "meetup-1",
      p_accept: false,
    });
    expect(mocks.trackProductEvent).toHaveBeenCalledTimes(1);
    expect(mocks.trackProductEvent).toHaveBeenCalledWith("meetup_declined");
  });

  it.each([true, false])("hatada (accept=%s) fırlatır ve olay çağrılmaz", async (accept) => {
    const error = new Error("respond failed");
    buildRpcClient({ data: null, error });

    await expect(respondToMeetup("meetup-1", accept)).rejects.toBe(error);
    expect(mocks.trackProductEvent).not.toHaveBeenCalled();
  });
});

describe("cancelMeetup", () => {
  it("cancel_meetup RPC'si + meetup_cancelled", async () => {
    // RPC son tanımı: 0043_meetups.sql:178.
    const { rpc } = buildRpcClient({ data: null, error: null });

    await expect(cancelMeetup("meetup-1")).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("cancel_meetup", { p_meetup_id: "meetup-1" });
    expect(mocks.trackProductEvent).toHaveBeenCalledTimes(1);
    expect(mocks.trackProductEvent).toHaveBeenCalledWith("meetup_cancelled");
  });

  it("hatada fırlatır ve olay çağrılmaz", async () => {
    const error = new Error("cancel failed");
    buildRpcClient({ data: null, error });

    await expect(cancelMeetup("meetup-1")).rejects.toBe(error);
    expect(mocks.trackProductEvent).not.toHaveBeenCalled();
  });
});

describe("subscribeToMeetup", () => {
  /** channel().on().subscribe() zinciri: on/subscribe aynı nesneyi döndürür. */
  function buildChannelClient() {
    const channelObj = {
      on: vi.fn(),
      subscribe: vi.fn(),
    };
    channelObj.on.mockReturnValue(channelObj);
    channelObj.subscribe.mockReturnValue(channelObj);
    const channel = vi.fn().mockReturnValue(channelObj);
    const removeChannel = vi.fn();
    mocks.requireSupabaseClient.mockReturnValue({ channel, removeChannel });
    return { channel, channelObj, removeChannel };
  }

  it("conversation:<cid>:meetup kanalına postgres_changes filtresiyle bir kez abone olur", () => {
    // Gizli bağ: kanal `postgres_changes` (yayın 0045_meetups_realtime.sql:7,
    // yetki `meetups_select_participant` 0043:58). `can_access_conversation_
    // realtime` (0031:17-18) yalnız `:ephemeral` konusunu kapsar, bu kanala
    // UYGULANMAZ -> G03 düzeltmesi bu kanalı etkilemez. Kanal ileride private
    // yapılırsa o fonksiyonun regex'i genişletilmeli.
    const { channel, channelObj } = buildChannelClient();
    const onChange = vi.fn();

    subscribeToMeetup("conv-1", onChange);

    expect(channel).toHaveBeenCalledTimes(1);
    expect(channel).toHaveBeenCalledWith("conversation:conv-1:meetup");
    expect(channelObj.on).toHaveBeenCalledTimes(1);
    expect(channelObj.on).toHaveBeenCalledWith(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "meetups",
        filter: "conversation_id=eq.conv-1",
      },
      onChange,
    );
    expect(channelObj.subscribe).toHaveBeenCalledTimes(1);
  });

  it("abonelik sırasında callback çağrılmaz", () => {
    buildChannelClient();
    const onChange = vi.fn();

    subscribeToMeetup("conv-1", onChange);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("temizleyici aynı kanalla removeChannel'ı bir kez çağırır", () => {
    const { channelObj, removeChannel } = buildChannelClient();

    const unsubscribe = subscribeToMeetup("conv-1", vi.fn());
    expect(removeChannel).not.toHaveBeenCalled();

    unsubscribe();

    expect(removeChannel).toHaveBeenCalledTimes(1);
    expect(removeChannel).toHaveBeenCalledWith(channelObj);
  });
});
