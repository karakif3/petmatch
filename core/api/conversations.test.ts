import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendMessage } from "./conversations";

/**
 * core/api test kalıbı (README "Test kalıbı ve yüklenebilirlik"):
 * - `./supabase.client` mock'lanır: gerçek Supabase istemcisi / ağ yok.
 *   `requireSupabaseClient()` her testte elle kurulan zincir sahtesini döner.
 * - `./observability` ve `./notifications` mock'lanır: yan etkiler (analytics,
 *   push isteği) sadece çağrı olarak gözlenir.
 * - Mock'lar `vi.hoisted` ile tanımlanır, her testte `beforeEach` ile sıfırlanır.
 */
const mocks = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn(),
  trackProductEvent: vi.fn(),
  requestNotificationDelivery: vi.fn(),
}));

vi.mock("./supabase.client", () => ({
  requireSupabaseClient: mocks.requireSupabaseClient,
}));
vi.mock("./observability", () => ({
  trackProductEvent: mocks.trackProductEvent,
}));
vi.mock("./notifications", () => ({
  requestNotificationDelivery: mocks.requestNotificationDelivery,
}));

const messageRow = {
  id: "msg-1",
  conversation_id: "conv-1",
  sender_id: "user-1",
  body: "Merhaba",
  created_at: "2026-10-05T10:00:00Z",
  read_at: null,
};

/** from("messages").insert(...).select().single() zincirinin sahtesi. */
function buildClient(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ insert });
  mocks.requireSupabaseClient.mockReturnValue({ from });
  return { from, insert, select, single };
}

describe("sendMessage", () => {
  beforeEach(() => {
    mocks.requireSupabaseClient.mockReset();
    mocks.trackProductEvent.mockReset();
    mocks.requestNotificationDelivery.mockReset();
    mocks.requestNotificationDelivery.mockResolvedValue(undefined);
  });

  it.each(["", "   ", "\n\t  "])(
    "boş/boşluk gövde (%j) -> 'Mesaj boş olamaz.' ve insert çağrılmaz",
    async (body) => {
      const client = buildClient({ data: messageRow, error: null });

      await expect(
        sendMessage({ conversationId: "conv-1", senderId: "user-1", body }),
      ).rejects.toThrow("Mesaj boş olamaz.");

      expect(client.insert).not.toHaveBeenCalled();
      expect(mocks.requestNotificationDelivery).not.toHaveBeenCalled();
      expect(mocks.trackProductEvent).not.toHaveBeenCalled();
    },
  );

  it("insert yükü yalnız conversation_id, sender_id ve trim'li body içerir", async () => {
    const client = buildClient({ data: messageRow, error: null });

    await sendMessage({
      conversationId: "conv-1",
      senderId: "user-1",
      body: "  Merhaba  \n",
    });

    expect(client.from).toHaveBeenCalledWith("messages");
    expect(client.insert).toHaveBeenCalledTimes(1);
    // Gizli bağ: 20260929120000_abuse_and_storage_hardening.sql kolon grant'ı
    // messages insert'ini yalnız bu üç kolonla sınırlar. Yüke created_at /
    // read_at eklenirse prod'da reddedilir. İstemci `id` de göndermiyor
    // (idempotency yok; mevcut davranış kilitli). Bu yüzden tam eşitlik.
    expect(client.insert).toHaveBeenCalledWith({
      conversation_id: "conv-1",
      sender_id: "user-1",
      body: "Merhaba",
    });
    expect(Object.keys(client.insert.mock.calls[0][0]).sort()).toEqual([
      "body",
      "conversation_id",
      "sender_id",
    ]);
  });

  it("başarıda satırı ChatMessage'a eşler", async () => {
    buildClient({ data: messageRow, error: null });

    const message = await sendMessage({
      conversationId: "conv-1",
      senderId: "user-1",
      body: "Merhaba",
    });

    expect(message).toEqual({
      id: "msg-1",
      conversationId: "conv-1",
      senderId: "user-1",
      body: "Merhaba",
      createdAt: "2026-10-05T10:00:00Z",
      readAt: null,
    });
  });

  it("başarıda requestNotificationDelivery({type:'message'}) bir kez çağrılır", async () => {
    buildClient({ data: messageRow, error: null });

    await sendMessage({ conversationId: "conv-1", senderId: "user-1", body: "Merhaba" });

    expect(mocks.requestNotificationDelivery).toHaveBeenCalledTimes(1);
    expect(mocks.requestNotificationDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ type: "message" }),
    );
    expect(mocks.requestNotificationDelivery).toHaveBeenCalledWith({
      type: "message",
      messageId: "msg-1",
    });
  });

  it("başarıda message_sent analytics olayı bir kez gönderilir", async () => {
    buildClient({ data: messageRow, error: null });

    await sendMessage({ conversationId: "conv-1", senderId: "user-1", body: "Merhaba" });

    expect(mocks.trackProductEvent).toHaveBeenCalledTimes(1);
    expect(mocks.trackProductEvent).toHaveBeenCalledWith("message_sent");
  });

  it("bildirim isteği reddedilirse mesaj yine döner (hata loglanır, fırlatılmaz)", async () => {
    buildClient({ data: messageRow, error: null });
    mocks.requestNotificationDelivery.mockRejectedValue(new Error("push down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const message = await sendMessage({
      conversationId: "conv-1",
      senderId: "user-1",
      body: "Merhaba",
    });
    await Promise.resolve();

    expect(message.id).toBe("msg-1");
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("insert hatasında aynı hatayı fırlatır; bildirim ve analytics çağrılmaz", async () => {
    const dbError = new Error("permission denied");
    buildClient({ data: null, error: dbError });

    await expect(
      sendMessage({ conversationId: "conv-1", senderId: "user-1", body: "Merhaba" }),
    ).rejects.toBe(dbError);

    expect(mocks.requestNotificationDelivery).not.toHaveBeenCalled();
    expect(mocks.trackProductEvent).not.toHaveBeenCalled();
  });
});
