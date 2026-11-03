import { describe, expect, it } from "vitest";

import { retryTransient } from "./retry";

const noSleep = async () => undefined;

describe("retryTransient", () => {
  it("saat farkı (PGRST303) ikinci denemede geçerse sonucu döner", async () => {
    let calls = 0;
    const result = await retryTransient(
      async () => {
        calls += 1;
        if (calls === 1) throw { code: "PGRST303", message: "JWT issued at future" };
        return "ok";
      },
      { sleep: noSleep },
    );
    expect(result).toBe("ok");
    expect(calls).toBe(2);
  });

  it("ağ hatasında sınır kadar dener, sonra son hatayı fırlatır", async () => {
    let calls = 0;
    const waits: number[] = [];
    await expect(
      retryTransient(
        async () => {
          calls += 1;
          throw new TypeError("Network request failed");
        },
        { delaysMs: [10, 20], sleep: async (ms) => void waits.push(ms) },
      ),
    ).rejects.toThrow("Network request failed");
    expect(calls).toBe(3);
    expect(waits).toEqual([10, 20]);
  });

  it("kalıcı hatada (RLS) tekrar denemez", async () => {
    let calls = 0;
    await expect(
      retryTransient(
        async () => {
          calls += 1;
          throw { code: "42501", message: "permission denied" };
        },
        { sleep: noSleep },
      ),
    ).rejects.toMatchObject({ code: "42501" });
    expect(calls).toBe(1);
  });
});
