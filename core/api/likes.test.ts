import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadMyActivePetId, loadPendingLikes, loadPendingLikesCount } from "./likes";

/**
 * core/api test kalıbı (README "Test kalıbı ve yüklenebilirlik"):
 * - `./supabase.client` mock'lanır: gerçek Supabase istemcisi / ağ yok.
 * - `./observability` ve `./notifications` mock'lanır: `likes.ts` -> `discovery.ts`
 *   bu ikisini import eder; yüklenebilirlik için gerekli, burada çağrılmazlar.
 * - Mock'lar `vi.hoisted` ile tanımlanır, her testte `beforeEach` ile sıfırlanır.
 *
 * Gizli bağ (0042_likes_tab.sql:5-8): anonimleştirme sunucuda değil.
 * `pending_likes` SECURITY DEFINER gerçek kartları döner; ücretsiz görünümü
 * istemci "bulanık kartla" simüle eder. Bu test yalnız istemcinin sunucudan
 * gelen satırı olduğu gibi eşlediğini kilitler; "olması gereken" (ödeme duvarı)
 * sahip kararıdır ve burada yazılmaz. RPC'nin son tanımı
 * 0068_owner_age_gender_one_way.sql:317 (sahip yaş/cinsiyeti tek yönlü).
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

type Row = Record<string, unknown>;

function makeRow(overrides: Row = {}): Row {
  return {
    id: "pet-1",
    owner_id: "owner-1",
    name: "Pamuk",
    species: "dog",
    breed: "Golden",
    birth_date: "2022-01-02",
    gender: "female",
    is_neutered: true,
    size: "medium",
    energy_level: "medium",
    temperaments: [],
    good_with_cats: true,
    good_with_dogs: true,
    good_with_kids: false,
    goals: ["playdate"],
    bio: "Merhaba",
    photo_paths: ["p/1.jpg", "p/2.jpg"],
    city: "Istanbul",
    distance_bucket: "near",
    activity_bucket: "today",
    owner_profile_shown: false,
    owner_display_name: null,
    owner_avatar_path: null,
    owner_bio: null,
    owner_gender: null,
    owner_age_bucket: null,
    owner_social_open: false,
    owner_verified: false,
    owner_interests: [],
    is_super: false,
    liked_at: "2026-10-06T10:00:00Z",
    ...overrides,
  };
}

function buildStorage(
  signed: { data: unknown; error: unknown } = { data: [], error: null },
) {
  const createSignedUrls = vi.fn().mockResolvedValue(signed);
  const createSignedUrl = vi.fn();
  const getPublicUrl = vi.fn((path: string) => ({ data: { publicUrl: `pub://${path}` } }));
  const bucketApi = { createSignedUrls, createSignedUrl, getPublicUrl };
  const storageFrom = vi.fn().mockReturnValue(bucketApi);
  return { storage: { from: storageFrom }, storageFrom, createSignedUrls, createSignedUrl };
}

function buildRpcClient(
  result: { data: unknown; error: unknown },
  signed?: { data: unknown; error: unknown },
) {
  const rpc = vi.fn().mockResolvedValue(result);
  const st = buildStorage(signed);
  mocks.requireSupabaseClient.mockReturnValue({ rpc, storage: st.storage });
  return { rpc, ...st };
}

beforeEach(() => {
  mocks.requireSupabaseClient.mockReset();
  mocks.trackProductEvent.mockReset();
  mocks.requestNotificationDelivery.mockReset();
});

describe("loadPendingLikesCount", () => {
  it("rpc('pending_likes_count') çağırır ve sayıyı döner", async () => {
    const { rpc } = buildRpcClient({ data: 7, error: null });
    await expect(loadPendingLikesCount()).resolves.toBe(7);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("pending_likes_count");
  });

  it("data null -> 0", async () => {
    buildRpcClient({ data: null, error: null });
    await expect(loadPendingLikesCount()).resolves.toBe(0);
  });

  it("hata -> fırlatır", async () => {
    const err = new Error("rpc patladı");
    buildRpcClient({ data: null, error: err });
    await expect(loadPendingLikesCount()).rejects.toBe(err);
  });
});

describe("loadPendingLikes", () => {
  it("rpc('pending_likes', { p_limit: 50 }) çağırır (sabit 50)", async () => {
    const { rpc } = buildRpcClient({ data: [], error: null });
    await loadPendingLikes();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("pending_likes", { p_limit: 50 });
  });

  it("hata -> fırlatır ve storage çağrılmaz", async () => {
    const err = new Error("rpc patladı");
    const { storageFrom } = buildRpcClient({ data: null, error: err });
    await expect(loadPendingLikes()).rejects.toBe(err);
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it("data null -> []", async () => {
    buildRpcClient({ data: null, error: null });
    await expect(loadPendingLikes()).resolves.toEqual([]);
  });

  it("kart: mapDiscoveryRow alanları + isSuper/likedAt/isActive/previouslyPassed", async () => {
    buildRpcClient({
      data: [makeRow({ is_super: true, liked_at: "2026-10-06T12:34:56Z" })],
      error: null,
    });
    const [item] = await loadPendingLikes();
    expect(item.likedAt).toBe("2026-10-06T12:34:56Z");
    expect(item.card).toMatchObject({
      id: "pet-1",
      ownerId: "owner-1",
      name: "Pamuk",
      species: "dog",
      breed: "Golden",
      birthDate: "2022-01-02",
      gender: "female",
      isNeutered: true,
      size: "medium",
      goodWithCats: true,
      goodWithDogs: true,
      goodWithKids: false,
      goals: ["playdate"],
      bio: "Merhaba",
      photoUrls: ["pub://p/1.jpg", "pub://p/2.jpg"],
      city: "Istanbul",
      distanceBucket: "near",
      activityBucket: "today",
      ownerProfileShown: false,
      isSuper: true,
      isActive: true,
      previouslyPassed: false,
    });
    expect(item.card).not.toHaveProperty("compatibility");
  });

  it("isSuper false satırda false kalır; sırayı korur", async () => {
    buildRpcClient({
      data: [
        makeRow({ id: "a", liked_at: "2026-10-06T10:00:00Z" }),
        makeRow({ id: "b", is_super: true, liked_at: "2026-10-05T10:00:00Z" }),
      ],
      error: null,
    });
    const items = await loadPendingLikes();
    expect(items.map((i) => [i.card.id, i.card.isSuper, i.likedAt])).toEqual([
      ["a", false, "2026-10-06T10:00:00Z"],
      ["b", true, "2026-10-05T10:00:00Z"],
    ]);
  });

  describe("sahip özeti", () => {
    it("owner_profile_shown=false -> owner null (alanlar dolu olsa bile)", async () => {
      const { createSignedUrls } = buildRpcClient({
        data: [
          makeRow({
            owner_profile_shown: false,
            owner_display_name: "Ayşe",
            owner_avatar_path: "av/1.jpg",
            owner_bio: "bio",
          }),
        ],
        error: null,
      });
      const [item] = await loadPendingLikes();
      expect(item.card.owner).toBeNull();
      // gösterilmeyen sahibin avatarı imzalanmaz
      expect(createSignedUrls).not.toHaveBeenCalled();
    });

    it("owner_profile_shown=true ama ad/avatar/bio boş -> owner null", async () => {
      buildRpcClient({
        data: [
          makeRow({
            owner_profile_shown: true,
            owner_display_name: "",
            owner_avatar_path: null,
            owner_bio: null,
          }),
        ],
        error: null,
      });
      const [item] = await loadPendingLikes();
      expect(item.card.owner).toBeNull();
    });

    it("görünen sahip: alanlar eşlenir, avatar imzalı URL olur", async () => {
      const { createSignedUrls, storageFrom } = buildRpcClient(
        {
          data: [
            makeRow({
              owner_profile_shown: true,
              owner_display_name: "Ayşe",
              owner_avatar_path: "av/1.jpg",
              owner_bio: "Köpek sever",
              owner_gender: "female",
              owner_age_bucket: "25-34",
              owner_social_open: true,
              owner_verified: true,
            }),
          ],
          error: null,
        },
        { data: [{ signedUrl: "signed://av/1.jpg" }], error: null },
      );
      const [item] = await loadPendingLikes();
      expect(item.card.owner).toMatchObject({
        displayName: "Ayşe",
        photoUrl: "signed://av/1.jpg",
        bio: "Köpek sever",
        gender: "female",
        ageBucket: "25-34",
        socialOpen: true,
        verified: true,
        extraPhotoUrls: [],
      });
      expect(storageFrom).toHaveBeenCalledWith("owner-avatars");
      expect(createSignedUrls).toHaveBeenCalledWith(["av/1.jpg"], 1800);
    });

    it("avatar imzalama satır başına değil tek createSignedUrls çağrısı; aynı yol bir kez", async () => {
      const shown = { owner_profile_shown: true, owner_display_name: "X" };
      const { createSignedUrls, createSignedUrl } = buildRpcClient(
        {
          data: [
            makeRow({ id: "a", ...shown, owner_avatar_path: "av/1.jpg" }),
            makeRow({ id: "b", ...shown, owner_avatar_path: "av/1.jpg" }),
            makeRow({ id: "c", ...shown, owner_avatar_path: "av/2.jpg" }),
            makeRow({
              id: "d",
              owner_profile_shown: false,
              owner_avatar_path: "av/gizli.jpg",
            }),
          ],
          error: null,
        },
        {
          data: [{ signedUrl: "signed://1" }, { signedUrl: "signed://2" }],
          error: null,
        },
      );
      const items = await loadPendingLikes();
      expect(createSignedUrls).toHaveBeenCalledTimes(1);
      expect(createSignedUrls).toHaveBeenCalledWith(["av/1.jpg", "av/2.jpg"], 1800);
      expect(createSignedUrl).not.toHaveBeenCalled();
      expect(items.map((i) => i.card.owner?.photoUrl ?? null)).toEqual([
        "signed://1",
        "signed://1",
        "signed://2",
        null,
      ]);
    });

    it("imzalama hatası -> kart photoUrl null ile döner, fırlatmaz", async () => {
      buildRpcClient(
        {
          data: [
            makeRow({
              owner_profile_shown: true,
              owner_display_name: "Ayşe",
              owner_avatar_path: "av/1.jpg",
            }),
          ],
          error: null,
        },
        { data: null, error: new Error("imza hatası") },
      );
      const items = await loadPendingLikes();
      expect(items).toHaveLength(1);
      expect(items[0].card.owner).toMatchObject({ displayName: "Ayşe", photoUrl: null });
    });

    it.each(["female", "male", "other"])("owner_gender %s korunur", async (gender) => {
      buildRpcClient({
        data: [
          makeRow({
            owner_profile_shown: true,
            owner_display_name: "X",
            owner_gender: gender,
          }),
        ],
        error: null,
      });
      const [item] = await loadPendingLikes();
      expect(item.card.owner?.gender).toBe(gender);
    });

    it.each(["unknown", "", "FEMALE", null])(
      "owner_gender %j (geçersiz) -> null",
      async (gender) => {
        buildRpcClient({
          data: [
            makeRow({
              owner_profile_shown: true,
              owner_display_name: "X",
              owner_gender: gender,
            }),
          ],
          error: null,
        });
        const [item] = await loadPendingLikes();
        expect(item.card.owner?.gender).toBeNull();
      },
    );
  });
});

describe("loadMyActivePetId", () => {
  /** from("pets").select("id").eq(...).eq(...).maybeSingle() zincirinin sahtesi. */
  function buildPetsClient(result: { data: unknown; error: unknown }) {
    const maybeSingle = vi.fn().mockResolvedValue(result);
    const eq2 = vi.fn().mockReturnValue({ maybeSingle });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    const from = vi.fn().mockReturnValue({ select });
    mocks.requireSupabaseClient.mockReturnValue({ from });
    return { from, select, eq1, eq2, maybeSingle };
  }

  it("pets zincirini doğru filtrelerle çağırır ve id döner", async () => {
    const c = buildPetsClient({ data: { id: "pet-9" }, error: null });
    await expect(loadMyActivePetId("user-1")).resolves.toBe("pet-9");
    expect(c.from).toHaveBeenCalledWith("pets");
    expect(c.select).toHaveBeenCalledWith("id");
    expect(c.eq1).toHaveBeenCalledWith("owner_id", "user-1");
    expect(c.eq2).toHaveBeenCalledWith("is_active", true);
    expect(c.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("satır yok -> null", async () => {
    buildPetsClient({ data: null, error: null });
    await expect(loadMyActivePetId("user-1")).resolves.toBeNull();
  });

  it("hata -> fırlatır", async () => {
    const err = new Error("db hatası");
    buildPetsClient({ data: null, error: err });
    await expect(loadMyActivePetId("user-1")).rejects.toBe(err);
  });
});
