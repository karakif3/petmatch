import { describe, expect, it } from "vitest";

import { ownerAgeBucket, ownerAgeBucketChanged } from "./owner-age-bucket";

const day = (iso: string) => new Date(`${iso}T12:00:00`);

describe("ownerAgeBucket", () => {
  it("18–24 ve 25–29 ayrı durur", () => {
    expect(ownerAgeBucket("2006-08-27", day("2026-08-27"))).toBe("18–24 yaş");
    expect(ownerAgeBucket("2001-08-27", day("2026-08-27"))).toBe("25–29 yaş");
  });

  it("30 ve üstü on yıl kovasına düşer", () => {
    expect(ownerAgeBucket("1995-01-01", day("2026-08-27"))).toBe("30'lu yaşlar");
    expect(ownerAgeBucket("1980-06-01", day("2026-08-27"))).toBe("40'lu yaşlar");
  });

  it("doğum gününden bir gün önce yılı indirmez", () => {
    expect(ownerAgeBucket("2001-08-28", day("2026-08-27"))).toBe("18–24 yaş");
  });

  it("boş veya 18 altı null", () => {
    expect(ownerAgeBucket(null)).toBeNull();
    expect(ownerAgeBucket("2015-01-01", day("2026-08-27"))).toBeNull();
  });

  it("kova değişimini ilk doldurmadan ayırır", () => {
    const today = day("2026-08-27");
    expect(ownerAgeBucketChanged(null, "2001-01-01", today)).toBe(false);
    expect(ownerAgeBucketChanged("2004-01-01", "2003-01-01", today)).toBe(false);
    expect(ownerAgeBucketChanged("2004-01-01", "1998-01-01", today)).toBe(true);
  });
});
