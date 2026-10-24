import { beforeEach, describe, expect, it, vi } from "vitest";
import { groupByPlace, listParkNow, minutesLeft, startParkCheckin, type ParkCheckin } from "./park";

const mocks = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn(),
  trackProductEvent: vi.fn(),
  requestNotificationDelivery: vi.fn(),
}));

vi.mock("./supabase.client", () => ({ requireSupabaseClient: mocks.requireSupabaseClient }));
vi.mock("./observability", () => ({ trackProductEvent: mocks.trackProductEvent }));
vi.mock("./notifications", () => ({
  requestNotificationDelivery: mocks.requestNotificationDelivery,
}));


function client(rpcResult: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const getPublicUrl = vi.fn((path: string) => ({ data: { publicUrl: `https://cdn/${path}` } }));
  const from = vi.fn(() => ({ getPublicUrl }));
  mocks.requireSupabaseClient.mockReturnValue({ rpc, storage: { from } });
  return { rpc, from };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requestNotificationDelivery.mockResolvedValue(undefined);
});

describe("park", () => {
  it("startParkCheckin: RPC parametreleri ve check-in kimliğiyle bildirim", async () => {
    const { rpc } = client({ data: "c-1", error: null });
    await expect(startParkCheckin({ placeId: "p-1", durationMinutes: 60 })).resolves.toBe("c-1");
    expect(rpc).toHaveBeenCalledWith("start_park_checkin", {
      p_place_id: "p-1",
      p_duration_minutes: 60,
    });
    expect(mocks.requestNotificationDelivery).toHaveBeenCalledWith({
      type: "park_checkin",
      checkinId: "c-1",
    });
  });

  it("startParkCheckin: RPC hatasında bildirim istenmez, hata aynen fırlar", async () => {
    const error = { message: "rate_limited:park_checkins", code: "P0001" };
    client({ data: null, error });
    await expect(startParkCheckin({ placeId: "p-1", durationMinutes: 60 })).rejects.toBe(error);
    expect(mocks.requestNotificationDelivery).not.toHaveBeenCalled();
  });

  it("listParkNow: satırı eşler, fotoğraf yolunu public URL'ye çevirir", async () => {
    const { from } = client({
      data: [
        {
          checkin_id: "c-1",
          place_id: "p-1",
          place_name: "Yoğurtçu Parkı",
          pet_id: "pet-1",
          pet_name: "Ada",
          species: "dog",
          size: "small",
          pet_photo_path: "u/pet-1/0.jpg",
          owner_name: null,
          ends_at: "2026-10-24T18:00:00Z",
          is_mine: false,
        },
      ],
      error: null,
    });
    const [row] = await listParkNow();
    expect(from).toHaveBeenCalledWith("pet-photos");
    expect(row).toMatchObject({
      id: "c-1",
      placeName: "Yoğurtçu Parkı",
      petPhotoUrl: "https://cdn/u/pet-1/0.jpg",
      ownerName: null,
      isMine: false,
    });
  });

  it("groupByPlace sunucu sırasını korur", () => {
    const c = (id: string, placeId: string) => ({ id, placeId, placeName: placeId }) as ParkCheckin;
    const groups = groupByPlace([c("1", "a"), c("2", "b"), c("3", "a")]);
    expect(groups.map((g) => [g.placeId, g.checkins.map((x) => x.id)])).toEqual([
      ["a", ["1", "3"]],
      ["b", ["2"]],
    ]);
  });

  it("minutesLeft geçmişte 0'a sabitlenir", () => {
    const now = new Date("2026-10-24T17:00:00Z");
    expect(minutesLeft("2026-10-24T17:45:00Z", now)).toBe(45);
    expect(minutesLeft("2026-10-24T16:00:00Z", now)).toBe(0);
  });
});
