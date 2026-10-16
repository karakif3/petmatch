import { beforeEach, describe, expect, it, vi } from "vitest";
import { listRegions, loadMyRegionWaitlist, setMyRegion } from "./regions";

/**
 * core/api/regions.ts sözleşmesi (pilot bölge seçimi + bekleme listesi).
 *
 * Gizli bağlar:
 * - loadMyRegionWaitlist kullanıcı filtresi yazmaz (`eq` yok); tek satırı RLS
 *   verir (`region_waitlist_select_self`, 0053_besiktas_region_waitlist.sql:28-30,
 *   user_id = auth.uid()). Policy gevşerse maybeSingle çok satır hatası verir.
 * - RPC `set_my_region(text, text default null, boolean default false)`
 *   (0053:37-75): parametre adları sunucu imzasına bağlı, değişirse istemci
 *   sessizce bozulur. Sunucu da nullif(trim(...)) yapar ve "other" için 2-80
 *   karakter ister (0053:56-60); istemci trim'i bilgi amaçlıdır.
 *   `p_requested_location: null` istemcide `null as unknown as string` cast'iyle
 *   gider (tip drift'i, D03 ailesi) -> test değeri kilitler, tipi değil.
 * - Tablo varsayılanı `notify_when_open default true` (0053:21) ama RPC ve
 *   istemci varsayılanı `false`; mevcut davranış kilitlenir.
 * - Sunucu kuralları supabase/tests/regions.test.sql'de; burada yalnız istemci
 *   eşlemesi.
 */
const mocks = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn(),
}));

vi.mock("./supabase.client", () => ({
  requireSupabaseClient: mocks.requireSupabaseClient,
}));

type Result = { data: unknown; error: unknown };

function listSetup(result: Result) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn().mockResolvedValue(result),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  const from = vi.fn().mockReturnValue(chain);
  mocks.requireSupabaseClient.mockReturnValue({ from });
  return { from, chain };
}

function rpcSetup(error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data: null, error });
  mocks.requireSupabaseClient.mockReturnValue({ rpc });
  return rpc;
}

function waitlistSetup(result: Result) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  chain.select.mockReturnValue(chain);
  const from = vi.fn().mockReturnValue(chain);
  mocks.requireSupabaseClient.mockReturnValue({ from });
  return { from, chain };
}

beforeEach(() => {
  mocks.requireSupabaseClient.mockReset();
});

describe("listRegions", () => {
  it("aktif bölgeleri sort_order ile sorgular", async () => {
    const { from, chain } = listSetup({ data: [], error: null });
    await listRegions();
    expect(from).toHaveBeenCalledWith("regions");
    expect(chain.select).toHaveBeenCalledWith("slug,name,city,is_pilot,sort_order");
    expect(chain.eq).toHaveBeenCalledWith("is_active", true);
    expect(chain.order).toHaveBeenCalledWith("sort_order");
  });

  it("satırları eşler: is_pilot -> isPilot, city null korunur, sort_order çıktıda yok, sıra korunur", async () => {
    listSetup({
      data: [
        { slug: "besiktas", name: "Beşiktaş", city: "İstanbul", is_pilot: true, sort_order: 2 },
        { slug: "other", name: "Diğer", city: null, is_pilot: false, sort_order: 1 },
      ],
      error: null,
    });
    const result = await listRegions();
    expect(result).toEqual([
      { slug: "besiktas", name: "Beşiktaş", city: "İstanbul", isPilot: true },
      { slug: "other", name: "Diğer", city: null, isPilot: false },
    ]);
    expect(result[0]).not.toHaveProperty("sort_order");
    expect(result[0]).not.toHaveProperty("sortOrder");
  });

  it("data null ise boş dizi döner", async () => {
    listSetup({ data: null, error: null });
    await expect(listRegions()).resolves.toEqual([]);
  });

  it("hatayı aynı nesneyle fırlatır", async () => {
    const err = new Error("boom");
    listSetup({ data: null, error: err });
    await expect(listRegions()).rejects.toBe(err);
  });
});

describe("setMyRegion", () => {
  it("seçeneksiz: konum null, bildirim false", async () => {
    const rpc = rpcSetup();
    await setMyRegion("besiktas");
    expect(rpc).toHaveBeenCalledWith("set_my_region", {
      p_region_slug: "besiktas",
      p_requested_location: null,
      p_notify_when_open: false,
    });
    expect(rpc.mock.calls[0][1].p_requested_location).toBeNull();
  });

  it("requestedLocation trim'lenir", async () => {
    const rpc = rpcSetup();
    await setMyRegion("other", { requestedLocation: "  Kadıköy " });
    expect(rpc).toHaveBeenCalledWith("set_my_region", {
      p_region_slug: "other",
      p_requested_location: "Kadıköy",
      p_notify_when_open: false,
    });
  });

  it.each(["   ", ""])("boş/boşluk konum %j null olur", async (value) => {
    const rpc = rpcSetup();
    await setMyRegion("other", { requestedLocation: value });
    expect(rpc.mock.calls[0][1].p_requested_location).toBeNull();
  });

  it("notifyWhenOpen true iletilir", async () => {
    const rpc = rpcSetup();
    await setMyRegion("other", { requestedLocation: "Moda", notifyWhenOpen: true });
    expect(rpc).toHaveBeenCalledWith("set_my_region", {
      p_region_slug: "other",
      p_requested_location: "Moda",
      p_notify_when_open: true,
    });
  });

  it("hatayı aynı nesneyle fırlatır", async () => {
    const err = new Error("rpc failed");
    rpcSetup(err);
    await expect(setMyRegion("besiktas")).rejects.toBe(err);
  });
});

describe("loadMyRegionWaitlist", () => {
  it("kullanıcı filtresi olmadan (eq yok) maybeSingle ile okur", async () => {
    const { from, chain } = waitlistSetup({ data: null, error: null });
    await loadMyRegionWaitlist();
    expect(from).toHaveBeenCalledWith("region_waitlist");
    expect(chain.select).toHaveBeenCalledWith("requested_location,notify_when_open,updated_at");
    expect(chain.eq).not.toHaveBeenCalled();
    expect(chain.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("satırı camelCase'e eşler", async () => {
    waitlistSetup({
      data: {
        requested_location: "Kadıköy",
        notify_when_open: true,
        updated_at: "2026-10-01T10:00:00Z",
      },
      error: null,
    });
    await expect(loadMyRegionWaitlist()).resolves.toEqual({
      requestedLocation: "Kadıköy",
      notifyWhenOpen: true,
      updatedAt: "2026-10-01T10:00:00Z",
    });
  });

  it("satır yoksa null döner", async () => {
    waitlistSetup({ data: null, error: null });
    await expect(loadMyRegionWaitlist()).resolves.toBeNull();
  });

  it("hatayı aynı nesneyle fırlatır", async () => {
    const err = new Error("rls");
    waitlistSetup({ data: null, error: err });
    await expect(loadMyRegionWaitlist()).rejects.toBe(err);
  });
});
