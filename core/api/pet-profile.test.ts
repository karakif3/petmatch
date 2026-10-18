import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadPetProfile } from "./pet-profile";

/**
 * core/api test kalıbı (README "Test kalıbı ve yüklenebilirlik"):
 * - `./supabase.client` mock'lanır: gerçek Supabase istemcisi / ağ yok.
 * - `./observability` ve `./notifications` mock'lanır: `pet-profile.ts` ->
 *   `discovery.ts` bu ikisini import eder; yüklenebilirlik için gerekli,
 *   burada çağrılmazlar.
 * - Mock'lar `vi.hoisted` ile tanımlanır, her testte `beforeEach` ile sıfırlanır.
 *
 * Gizli bağ: görünürlüğü yalnız RLS belirler (`pets_select_matched`
 * 0006:133-134, `visible_pet_ids()` 0006:68-77). İstemci filtre yazmaz; satır
 * yoksa `null` döner ve ekran "artık görünmüyor" der. G04 düzeltmesi
 * (yalnız eşleşen pet görünür) bu sorguların SONUCUNU değiştirir, istemci
 * kodunu değil; bu test RLS'i taklit etmez. Sahip bilgisi bilerek yok
 * (0023 `get_conversation_owner_profile`) -> test sahip alanı beklemez.
 * Kova adı `discovery.ts`'te literal "pet-photos" (config'teki
 * `STORAGE_BUCKETS.petPhotos` ile aynı değer).
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
type Result = { data: unknown; error: unknown };

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
    energy_level: 3,
    temperaments: ["calm"],
    good_with_cats: true,
    good_with_dogs: false,
    good_with_kids: true,
    goals: ["playdate"],
    bio: "Merhaba",
    is_active: true,
    ...overrides,
  };
}

const chains = {
  pets: { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() },
  photos: { select: vi.fn(), eq: vi.fn(), order: vi.fn() },
};
const from = vi.fn();
const getPublicUrl = vi.fn();
const storageFrom = vi.fn();

function setup(petResult: Result, photoResult?: Result) {
  chains.pets.select.mockReturnValue(chains.pets);
  chains.pets.eq.mockReturnValue(chains.pets);
  chains.pets.maybeSingle.mockResolvedValue(petResult);
  chains.photos.select.mockReturnValue(chains.photos);
  chains.photos.eq.mockReturnValue(chains.photos);
  chains.photos.order.mockResolvedValue(photoResult ?? { data: [], error: null });
  from.mockImplementation((table: string) => {
    if (table === "pets") return chains.pets;
    if (table === "pet_photos") return chains.photos;
    throw new Error(`beklenmeyen tablo: ${table}`);
  });
  getPublicUrl.mockImplementation((path: string) => ({
    data: { publicUrl: `https://cdn.test/${path}` },
  }));
  storageFrom.mockReturnValue({ getPublicUrl });
  mocks.requireSupabaseClient.mockReturnValue({ from, storage: { from: storageFrom } });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("loadPetProfile", () => {
  it("pets sorgusu: select(*) + eq(id) + maybeSingle", async () => {
    setup({ data: makeRow(), error: null });
    await loadPetProfile("pet-1");
    expect(from).toHaveBeenNthCalledWith(1, "pets");
    expect(chains.pets.select).toHaveBeenCalledWith("*");
    expect(chains.pets.eq).toHaveBeenCalledWith("id", "pet-1");
    expect(chains.pets.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("pets hatası aynı nesneyle fırlar ve pet_photos sorgulanmaz", async () => {
    const error = new Error("pets hata");
    setup({ data: null, error });
    await expect(loadPetProfile("pet-1")).rejects.toBe(error);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalledWith("pet_photos");
  });

  it("satır yoksa (RLS gizledi) null döner ve pet_photos sorgulanmaz", async () => {
    setup({ data: null, error: null });
    await expect(loadPetProfile("pet-1")).resolves.toBeNull();
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalledWith("pet_photos");
  });

  it("pet_photos sorgusu: select(storage_path) + eq(pet_id) + order(position)", async () => {
    setup({ data: makeRow(), error: null });
    await loadPetProfile("pet-1");
    expect(from).toHaveBeenNthCalledWith(2, "pet_photos");
    expect(chains.photos.select).toHaveBeenCalledWith("storage_path");
    expect(chains.photos.eq).toHaveBeenCalledWith("pet_id", "pet-1");
    expect(chains.photos.order).toHaveBeenCalledWith("position");
  });

  it("pet_photos hatası aynı nesneyle fırlar", async () => {
    const error = new Error("foto hata");
    setup({ data: makeRow(), error: null }, { data: null, error });
    await expect(loadPetProfile("pet-1")).rejects.toBe(error);
  });

  it("pet_photos data null ise photoUrls boş", async () => {
    setup({ data: makeRow(), error: null }, { data: null, error: null });
    const pet = await loadPetProfile("pet-1");
    expect(pet?.photoUrls).toEqual([]);
  });

  it("satır alanlarını Pet'e eşler (sahip alanı yok)", async () => {
    setup({ data: makeRow(), error: null });
    const pet = await loadPetProfile("pet-1");
    expect(pet).toEqual({
      id: "pet-1",
      ownerId: "owner-1",
      name: "Pamuk",
      species: "dog",
      breed: "Golden",
      birthDate: "2022-01-02",
      gender: "female",
      isNeutered: true,
      size: "medium",
      energyLevel: 3,
      temperaments: ["calm"],
      goodWithCats: true,
      goodWithDogs: false,
      goodWithKids: true,
      goals: ["playdate"],
      bio: "Merhaba",
      photoUrls: [],
      isActive: true,
    });
  });

  it.each([
    [0, 1],
    [7, 5],
    [2.6, 3],
  ])("energy_level %s -> %s (1-5'e kırpılır, yuvarlanır)", async (input, expected) => {
    setup({ data: makeRow({ energy_level: input }), error: null });
    const pet = await loadPetProfile("pet-1");
    expect(pet?.energyLevel).toBe(expected);
  });

  it("bilinmeyen temperament değerlerini atar", async () => {
    setup({ data: makeRow({ temperaments: ["calm", "zzz"] }), error: null });
    const pet = await loadPetProfile("pet-1");
    expect(pet?.temperaments).toEqual(["calm"]);
  });

  it("photoUrls sunucu sırasıyla, pet-photos kovasının public URL'siyle üretilir", async () => {
    setup(
      { data: makeRow(), error: null },
      { data: [{ storage_path: "p/b.jpg" }, { storage_path: "p/a.jpg" }], error: null },
    );
    const pet = await loadPetProfile("pet-1");
    expect(storageFrom).toHaveBeenCalledWith("pet-photos");
    expect(getPublicUrl).toHaveBeenNthCalledWith(1, "p/b.jpg");
    expect(getPublicUrl).toHaveBeenNthCalledWith(2, "p/a.jpg");
    expect(pet?.photoUrls).toEqual(["https://cdn.test/p/b.jpg", "https://cdn.test/p/a.jpg"]);
  });
});
