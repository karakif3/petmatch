import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  swipePet,
  updateDiscoveryFilters,
  type DiscoveryFilterSettings,
} from "./discovery";

/**
 * core/api test kalıbı (README "Test kalıbı ve yüklenebilirlik"):
 * - `./supabase.client` mock'lanır: gerçek Supabase istemcisi / ağ yok.
 *   `requireSupabaseClient()` her testte `rpc` sahtesi olan bir nesne döner.
 * - `./observability` ve `./notifications` mock'lanır: analytics ve push
 *   isteği yalnız çağrı olarak gözlenir.
 * - Mock'lar `vi.hoisted` ile tanımlanır, her testte `beforeEach` ile sıfırlanır.
 *
 * GİZLİ BAĞ (RPC imzaları, son tanım `supabase/migrations/0064_pet_gender_filter.sql`):
 * - `swipe_pet(p_from_pet_id, p_to_pet_id, p_direction, p_is_super default false)
 *   returns table (match_id uuid, swipe_id uuid)` (satır 335-341).
 * - `update_my_discovery_filters(p_species, p_pet_genders, p_max_distance_km,
 *   p_distance_filter_enabled, p_min_age_years, p_max_age_years,
 *   p_require_visible_owner, p_require_owner_photo, p_require_owner_social,
 *   p_require_verified_owner, p_notify_on_new_candidates)` — 11 parametre
 *   (satır 461-473).
 * Parametre adı değişirse istemci derleme hatası vermeden bozulur; bu test
 * adları birebir kilitler. Swipe hız sınırı (`swipes_rate_limit`,
 * `20260929120000:233`) sunucudan hata olarak gelir -> hata yolu testi kapsar.
 * Karşılıklı beğeni yarışı sunucuda (`0008:114-119`); burada kapsanmaz.
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

function buildClient(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  mocks.requireSupabaseClient.mockReturnValue({ rpc });
  return { rpc };
}

const baseSwipe = { fromPetId: "pet-a", toPetId: "pet-b" } as const;

describe("swipePet", () => {
  beforeEach(() => {
    mocks.requireSupabaseClient.mockReset();
    mocks.trackProductEvent.mockReset();
    mocks.requestNotificationDelivery.mockReset();
    mocks.requestNotificationDelivery.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("swipe_pet RPC'sini imza adlarıyla çağırır; isSuper verilmezse p_is_super false", async () => {
    const client = buildClient({ data: [], error: null });

    await swipePet({ ...baseSwipe, direction: "like" });

    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith("swipe_pet", {
      p_from_pet_id: "pet-a",
      p_to_pet_id: "pet-b",
      p_direction: "like",
      p_is_super: false,
    });
  });

  it("isSuper true -> p_is_super true", async () => {
    const client = buildClient({ data: [], error: null });

    await swipePet({ ...baseSwipe, direction: "like", isSuper: true });

    expect(client.rpc).toHaveBeenCalledWith("swipe_pet", {
      p_from_pet_id: "pet-a",
      p_to_pet_id: "pet-b",
      p_direction: "like",
      p_is_super: true,
    });
  });

  it("RPC hatası fırlatılır; analytics ve bildirim çağrılmaz", async () => {
    const error = new Error("swipes_rate_limit");
    buildClient({ data: null, error });

    await expect(swipePet({ ...baseSwipe, direction: "like" })).rejects.toBe(error);

    expect(mocks.trackProductEvent).not.toHaveBeenCalled();
    expect(mocks.requestNotificationDelivery).not.toHaveBeenCalled();
  });

  describe("analytics olayı", () => {
    it("süper -> swipe_super_like", async () => {
      buildClient({ data: [], error: null });
      await swipePet({ ...baseSwipe, direction: "like", isSuper: true });
      expect(mocks.trackProductEvent).toHaveBeenCalledTimes(1);
      expect(mocks.trackProductEvent).toHaveBeenCalledWith("swipe_super_like");
    });

    it("like -> swipe_like", async () => {
      buildClient({ data: [], error: null });
      await swipePet({ ...baseSwipe, direction: "like" });
      expect(mocks.trackProductEvent).toHaveBeenCalledTimes(1);
      expect(mocks.trackProductEvent).toHaveBeenCalledWith("swipe_like");
    });

    it("pass -> swipe_pass", async () => {
      buildClient({ data: [], error: null });
      await swipePet({ ...baseSwipe, direction: "pass" });
      expect(mocks.trackProductEvent).toHaveBeenCalledTimes(1);
      expect(mocks.trackProductEvent).toHaveBeenCalledWith("swipe_pass");
    });

    it("pass + isSuper -> swipe_super_like (isSuper yönden önce gelir; mevcut davranış)", async () => {
      buildClient({ data: [], error: null });
      await swipePet({ ...baseSwipe, direction: "pass", isSuper: true });
      expect(mocks.trackProductEvent).toHaveBeenCalledWith("swipe_super_like");
    });
  });

  it("match_id varsa match_created + match bildirimi bir kez, dönüş match_id", async () => {
    buildClient({ data: [{ match_id: "match-1", swipe_id: "swipe-1" }], error: null });

    const result = await swipePet({ ...baseSwipe, direction: "like" });

    expect(result).toBe("match-1");
    expect(mocks.trackProductEvent).toHaveBeenCalledWith("swipe_like");
    expect(mocks.trackProductEvent).toHaveBeenCalledWith("match_created");
    expect(mocks.requestNotificationDelivery).toHaveBeenCalledTimes(1);
    expect(mocks.requestNotificationDelivery).toHaveBeenCalledWith({
      type: "match",
      matchId: "match-1",
    });
  });

  it("match_id varsa süper olsa da super_like bildirimi gitmez (yalnız match)", async () => {
    buildClient({ data: [{ match_id: "match-1", swipe_id: "swipe-1" }], error: null });

    await swipePet({ ...baseSwipe, direction: "like", isSuper: true });

    expect(mocks.requestNotificationDelivery).toHaveBeenCalledTimes(1);
    expect(mocks.requestNotificationDelivery).toHaveBeenCalledWith({
      type: "match",
      matchId: "match-1",
    });
  });

  it("match_id yok + süper + swipe_id -> super_like bildirimi, dönüş null", async () => {
    buildClient({ data: [{ match_id: null, swipe_id: "swipe-9" }], error: null });

    const result = await swipePet({ ...baseSwipe, direction: "like", isSuper: true });

    expect(result).toBeNull();
    expect(mocks.trackProductEvent).not.toHaveBeenCalledWith("match_created");
    expect(mocks.requestNotificationDelivery).toHaveBeenCalledTimes(1);
    expect(mocks.requestNotificationDelivery).toHaveBeenCalledWith({
      type: "super_like",
      swipeId: "swipe-9",
    });
  });

  it("match_id yok + süper değil -> bildirim yok, dönüş null", async () => {
    buildClient({ data: [{ match_id: null, swipe_id: "swipe-2" }], error: null });

    const result = await swipePet({ ...baseSwipe, direction: "like" });

    expect(result).toBeNull();
    expect(mocks.requestNotificationDelivery).not.toHaveBeenCalled();
    expect(mocks.trackProductEvent).not.toHaveBeenCalledWith("match_created");
  });

  it("match_id yok + süper ama swipe_id yok -> bildirim yok, dönüş null", async () => {
    buildClient({ data: [{ match_id: null, swipe_id: null }], error: null });

    const result = await swipePet({ ...baseSwipe, direction: "like", isSuper: true });

    expect(result).toBeNull();
    expect(mocks.requestNotificationDelivery).not.toHaveBeenCalled();
  });

  it.each([[[]], [null]])("data %j -> null döner, bildirim yok", async (data) => {
    buildClient({ data, error: null });

    const result = await swipePet({ ...baseSwipe, direction: "like", isSuper: true });

    expect(result).toBeNull();
    expect(mocks.requestNotificationDelivery).not.toHaveBeenCalled();
    expect(mocks.trackProductEvent).toHaveBeenCalledWith("swipe_super_like");
  });

  it("match bildirimi reddedilirse swipePet yine match_id ile çözülür; hata console.error'a", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("push down");
    mocks.requestNotificationDelivery.mockRejectedValue(failure);
    buildClient({ data: [{ match_id: "match-1", swipe_id: "swipe-1" }], error: null });

    await expect(swipePet({ ...baseSwipe, direction: "like" })).resolves.toBe("match-1");

    // `.catch` mikro-görevde çalışır; bir tur bekle.
    await Promise.resolve();
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]).toContain(failure);
  });

  it("super_like bildirimi reddedilirse swipePet yine null ile çözülür; hata console.error'a", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("push down");
    mocks.requestNotificationDelivery.mockRejectedValue(failure);
    buildClient({ data: [{ match_id: null, swipe_id: "swipe-9" }], error: null });

    await expect(
      swipePet({ ...baseSwipe, direction: "like", isSuper: true }),
    ).resolves.toBeNull();

    await Promise.resolve();
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]).toContain(failure);
  });
});

describe("updateDiscoveryFilters", () => {
  const settings: DiscoveryFilterSettings = {
    species: ["dog", "cat"],
    petGenders: ["female"],
    maxDistanceKm: 25,
    distanceFilterEnabled: true,
    minPetAgeYears: 1,
    maxPetAgeYears: 8,
    requireVisibleOwner: true,
    requirePhoto: false,
    requireSocial: true,
    requireVerified: false,
    notifyOnNewCandidates: true,
  };

  beforeEach(() => {
    mocks.requireSupabaseClient.mockReset();
  });

  it("update_my_discovery_filters'a 11 parametreyi imza adlarıyla eşler", async () => {
    const client = buildClient({ data: null, error: null });

    await expect(updateDiscoveryFilters(settings)).resolves.toBeUndefined();

    expect(client.rpc).toHaveBeenCalledTimes(1);
    // Alan eşlemesi: requirePhoto -> p_require_owner_photo,
    // requireSocial -> p_require_owner_social,
    // requireVerified -> p_require_verified_owner,
    // requireVisibleOwner -> p_require_visible_owner.
    expect(client.rpc).toHaveBeenCalledWith("update_my_discovery_filters", {
      p_species: ["dog", "cat"],
      p_pet_genders: ["female"],
      p_max_distance_km: 25,
      p_distance_filter_enabled: true,
      p_min_age_years: 1,
      p_max_age_years: 8,
      p_require_visible_owner: true,
      p_require_owner_photo: false,
      p_require_owner_social: true,
      p_require_verified_owner: false,
      p_notify_on_new_candidates: true,
    });
    const payload = client.rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(payload)).toHaveLength(11);
  });

  it("boolean bayrakları ters değerlerle de doğru parametreye gider", async () => {
    const client = buildClient({ data: null, error: null });

    await updateDiscoveryFilters({
      ...settings,
      requireVisibleOwner: false,
      requirePhoto: true,
      requireSocial: false,
      requireVerified: true,
      distanceFilterEnabled: false,
      notifyOnNewCandidates: false,
    });

    expect(client.rpc).toHaveBeenCalledWith(
      "update_my_discovery_filters",
      expect.objectContaining({
        p_require_visible_owner: false,
        p_require_owner_photo: true,
        p_require_owner_social: false,
        p_require_verified_owner: true,
        p_distance_filter_enabled: false,
        p_notify_on_new_candidates: false,
      }),
    );
  });

  it("minPetAgeYears/maxPetAgeYears null -> p_min/max_age_years null", async () => {
    const client = buildClient({ data: null, error: null });

    await updateDiscoveryFilters({ ...settings, minPetAgeYears: null, maxPetAgeYears: null });

    expect(client.rpc).toHaveBeenCalledWith(
      "update_my_discovery_filters",
      expect.objectContaining({ p_min_age_years: null, p_max_age_years: null }),
    );
  });

  it("minPetAgeYears/maxPetAgeYears undefined -> null (tip null'a izin verir; çalışma zamanı savunması)", async () => {
    const client = buildClient({ data: null, error: null });

    await updateDiscoveryFilters({
      ...settings,
      minPetAgeYears: undefined as unknown as null,
      maxPetAgeYears: undefined as unknown as null,
    });

    expect(client.rpc).toHaveBeenCalledWith(
      "update_my_discovery_filters",
      expect.objectContaining({ p_min_age_years: null, p_max_age_years: null }),
    );
  });

  it("yaş 0 null'a çevrilmez (?? yalnız null/undefined'ı yakalar)", async () => {
    const client = buildClient({ data: null, error: null });

    await updateDiscoveryFilters({ ...settings, minPetAgeYears: 0, maxPetAgeYears: 0 });

    expect(client.rpc).toHaveBeenCalledWith(
      "update_my_discovery_filters",
      expect.objectContaining({ p_min_age_years: 0, p_max_age_years: 0 }),
    );
  });

  it("RPC hatası fırlatılır", async () => {
    const error = new Error("rpc failed");
    buildClient({ data: null, error });

    await expect(updateDiscoveryFilters(settings)).rejects.toBe(error);
  });
});
