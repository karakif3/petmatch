import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMyPet, listMyPets, resetMyPetPasses, setActivePet } from "./pets";

/**
 * core/api test kalıbı (README "Test kalıbı ve yüklenebilirlik"):
 * - `./supabase.client` mock'lanır: gerçek Supabase istemcisi / ağ yok.
 * - `./observability`, `./notifications`, `./legal` zararsız mock'lar (pets.ts
 *   yalnız `./supabase.client` import eder).
 *
 * Gizli bağlar:
 * - RPC parametre adları sunucu imzasına bağlı: `create_my_pet(p_name, p_species,
 *   p_gender)` (0062_pet_roster.sql:30-34), `set_active_pet(p_pet_id)` (0062:74),
 *   `reset_my_pet_passes(p_pet_id)` -> integer (0063_pet_identity_change.sql:181).
 *   Ad değişirse istemci sessizce bozulur; bu test adları kilitler.
 * - Kova adı pets.ts'de sabit "pet-photos" (config.ts:39 STORAGE_BUCKETS.petPhotos
 *   ile aynı değer ama sabit kullanılmıyor) -> test literal bekler.
 * - Ad istemcide trim'lenmez; sunucu trim'ler (0062_pet_roster.sql:41).
 * - UI hatayı errorMessage(...) ile çevirir (app/profile/pets.tsx) -> test hata
 *   nesnesinin aynen fırlatıldığını kilitler, mesajı değil.
 * - listMyPets yalnız kendi petlerini okur (pets_select_own, 0006:130-131).
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
vi.mock("./legal", () => ({}));

type Result = { data: unknown; error: unknown };

function setup(opts: { pets?: Result; photos?: Result; rpc?: Result } = {}) {
  const petsOrder = vi.fn();
  const petsChain = {
    select: vi.fn(),
    eq: vi.fn(),
    order: petsOrder,
  };
  petsChain.select.mockReturnValue(petsChain);
  petsChain.eq.mockReturnValue(petsChain);
  // İlk order zinciri döner, ikincisi sonucu (await edilen).
  petsOrder
    .mockReturnValueOnce(petsChain)
    .mockResolvedValueOnce(opts.pets ?? { data: [], error: null });

  const photosOrder = vi.fn().mockResolvedValue(opts.photos ?? { data: [], error: null });
  const photosChain = {
    select: vi.fn(),
    in: vi.fn(),
    order: photosOrder,
  };
  photosChain.select.mockReturnValue(photosChain);
  photosChain.in.mockReturnValue(photosChain);

  const getPublicUrl = vi.fn((path: string) => ({
    data: { publicUrl: `https://cdn.test/${path}` },
  }));
  const storageFrom = vi.fn(() => ({ getPublicUrl }));
  const from = vi.fn((table: string) => (table === "pets" ? petsChain : photosChain));
  const rpc = vi.fn().mockResolvedValue(opts.rpc ?? { data: null, error: null });

  mocks.requireSupabaseClient.mockReturnValue({ from, rpc, storage: { from: storageFrom } });
  return { from, rpc, petsChain, photosChain, getPublicUrl, storageFrom };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listMyPets", () => {
  it("pets sorgusunu doğru zincirle kurar", async () => {
    const s = setup();
    await listMyPets("u1");
    expect(s.from).toHaveBeenCalledWith("pets");
    expect(s.petsChain.select).toHaveBeenCalledWith("id,name,species,gender,is_active");
    expect(s.petsChain.eq).toHaveBeenCalledWith("owner_id", "u1");
    expect(s.petsChain.order).toHaveBeenNthCalledWith(1, "is_active", { ascending: false });
    expect(s.petsChain.order).toHaveBeenNthCalledWith(2, "created_at", { ascending: true });
  });

  it("pets hatasında aynı hata nesnesini fırlatır, pet_photos sorgulanmaz", async () => {
    const err = new Error("boom");
    const s = setup({ pets: { data: null, error: err } });
    await expect(listMyPets("u1")).rejects.toBe(err);
    expect(s.from).not.toHaveBeenCalledWith("pet_photos");
  });

  it.each([[[]], [null]])("data %j -> [] ve pet_photos sorgulanmaz", async (data) => {
    const s = setup({ pets: { data, error: null } });
    await expect(listMyPets("u1")).resolves.toEqual([]);
    expect(s.from).not.toHaveBeenCalledWith("pet_photos");
  });

  it("fotoğraf sorgusu tek: pet id'leri sunucu sırasıyla, position'a göre", async () => {
    const s = setup({
      pets: {
        data: [
          { id: "b", name: "B", species: "dog", gender: "male", is_active: true },
          { id: "a", name: "A", species: "cat", gender: "female", is_active: false },
        ],
        error: null,
      },
    });
    await listMyPets("u1");
    expect(s.from.mock.calls.filter(([t]) => t === "pet_photos")).toHaveLength(1);
    expect(s.photosChain.select).toHaveBeenCalledWith("pet_id,storage_path,position");
    expect(s.photosChain.in).toHaveBeenCalledWith("pet_id", ["b", "a"]);
    expect(s.photosChain.order).toHaveBeenCalledWith("position");
  });

  it("fotoğraf hatasında aynı hata nesnesini fırlatır", async () => {
    const err = new Error("photos");
    setup({
      pets: {
        data: [{ id: "a", name: "A", species: "dog", gender: "male", is_active: true }],
        error: null,
      },
      photos: { data: null, error: err },
    });
    await expect(listMyPets("u1")).rejects.toBe(err);
  });

  it("eşler: pet sırası korunur, photoCount, ilk yoldan photoUrl, fotoğrafsız -> null/0", async () => {
    const s = setup({
      pets: {
        data: [
          { id: "p1", name: "Pamuk", species: "dog", gender: "female", is_active: true },
          { id: "p2", name: "Tarçın", species: "cat", gender: "male", is_active: false },
          { id: "p3", name: "Boncuk", species: "dog", gender: "male", is_active: false },
        ],
        error: null,
      },
      photos: {
        data: [
          { pet_id: "p2", storage_path: "p2/0.jpg", position: 0 },
          { pet_id: "p1", storage_path: "p1/0.jpg", position: 0 },
          { pet_id: "p1", storage_path: "p1/1.jpg", position: 1 },
        ],
        error: null,
      },
    });
    const out = await listMyPets("u1");
    expect(out).toEqual([
      {
        id: "p1",
        name: "Pamuk",
        species: "dog",
        gender: "female",
        isActive: true,
        photoCount: 2,
        photoUrl: "https://cdn.test/p1/0.jpg",
      },
      {
        id: "p2",
        name: "Tarçın",
        species: "cat",
        gender: "male",
        isActive: false,
        photoCount: 1,
        photoUrl: "https://cdn.test/p2/0.jpg",
      },
      {
        id: "p3",
        name: "Boncuk",
        species: "dog",
        gender: "male",
        isActive: false,
        photoCount: 0,
        photoUrl: null,
      },
    ]);
    // Kova literal "pet-photos" (config.ts:39 ile aynı değer).
    expect(s.storageFrom).toHaveBeenCalledWith("pet-photos");
    expect(s.getPublicUrl).toHaveBeenCalledTimes(2);
    expect(s.getPublicUrl).toHaveBeenCalledWith("p1/0.jpg");
    expect(s.getPublicUrl).toHaveBeenCalledWith("p2/0.jpg");
    expect(s.getPublicUrl).not.toHaveBeenCalledWith("p1/1.jpg");
  });

  it("photos null ise hepsi fotoğrafsız", async () => {
    const s = setup({
      pets: {
        data: [{ id: "a", name: "A", species: "dog", gender: "male", is_active: true }],
        error: null,
      },
      photos: { data: null, error: null },
    });
    const out = await listMyPets("u1");
    expect(out[0]).toMatchObject({ photoUrl: null, photoCount: 0 });
    expect(s.getPublicUrl).not.toHaveBeenCalled();
  });
});

describe("createMyPet", () => {
  it("create_my_pet RPC'sini p_ parametreleriyle çağırır, adı trim'lemez, data döner", async () => {
    const s = setup({ rpc: { data: "new-id", error: null } });
    await expect(
      createMyPet({ name: "  Pamuk  ", species: "dog", gender: "female" }),
    ).resolves.toBe("new-id");
    expect(s.rpc).toHaveBeenCalledWith("create_my_pet", {
      p_name: "  Pamuk  ",
      p_species: "dog",
      p_gender: "female",
    });
  });

  it("hatada aynı hata nesnesini fırlatır", async () => {
    const err = new Error("x");
    setup({ rpc: { data: null, error: err } });
    await expect(
      createMyPet({ name: "A", species: "cat", gender: "male" }),
    ).rejects.toBe(err);
  });
});

describe("setActivePet", () => {
  it("set_active_pet RPC'sini p_pet_id ile çağırır", async () => {
    const s = setup();
    await expect(setActivePet("p1")).resolves.toBeUndefined();
    expect(s.rpc).toHaveBeenCalledWith("set_active_pet", { p_pet_id: "p1" });
  });

  it("hatada aynı hata nesnesini fırlatır", async () => {
    const err = new Error("x");
    setup({ rpc: { data: null, error: err } });
    await expect(setActivePet("p1")).rejects.toBe(err);
  });
});

describe("resetMyPetPasses", () => {
  it("reset_my_pet_passes RPC'sini p_pet_id ile çağırır, sayıyı döner", async () => {
    const s = setup({ rpc: { data: 3, error: null } });
    await expect(resetMyPetPasses("p1")).resolves.toBe(3);
    expect(s.rpc).toHaveBeenCalledWith("reset_my_pet_passes", { p_pet_id: "p1" });
  });

  it("data null -> 0", async () => {
    setup({ rpc: { data: null, error: null } });
    await expect(resetMyPetPasses("p1")).resolves.toBe(0);
  });

  it("hatada aynı hata nesnesini fırlatır", async () => {
    const err = new Error("x");
    setup({ rpc: { data: null, error: err } });
    await expect(resetMyPetPasses("p1")).rejects.toBe(err);
  });
});
