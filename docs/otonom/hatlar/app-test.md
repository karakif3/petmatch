# Hat: app-test

| Alan | Değer |
|---|---|
| **Durum** | açık |
| **Seviye** | L2 (taslak PR) — "yeni hat bir alt seviyeden" kuralına Tellora/teacher-mvp emsali istisna, sahip onayı 2026-10-04 |
| **Rol (zorunlu)** | engineer → reviewer |
| **Amaç** | Testi olmayan `core/api` (vi.mock ile) ve `core/domain` saf mantığına davranışı kilitleyen vitest testi eklemek. Üretim kodu değişmez |
| **Kapsam** | Yalnız yeni `core/**/<modül>.test.ts` dosyaları (kaynağın yanında); maddede listelenen kaynak dosyalar yalnız okunur |
| **Asla** | README L0 yollar; `*.test.ts` dışı her değişiklik (saf-modül çıkarımı dahil — o iş 2. faz `app-kucuk-is`'in); mevcut testleri silmek/gevşetmek, `skip`/`only`; vitest config eklemek; `package.json` / bağımlılık (`npm install`); README'deki dört mock'la yüklenmeyen modülü zorlamak; gerçek ağ/Supabase çağrısı; snapshot; `app/`, `components/`, `stores/` testi; metro/simülatör |
| **Doğrulayıcı** | `npm run lint && npm run typecheck && npm test` yeşil, toplam test sayısı artmış (önce/sonra `Tests  N passed` satırı PR'da); CI (`static`, `database`, `edge-functions`) yeşil |
| **Çıktı** | Taslak PR, base `main`, branch `otonom/app-test/<id>-<kisa-ad>` (tek iş worktree'si `_otonom/petmatch/is`) |
| **Onay kapısı** | PR merge (sahip) |
| **Bekleyen onay sınırı** | 3 (3 açık `onay-bekliyor` PR varsa hat yeni iş almaz) |
| **Bütçe** | ilk hafta günde en fazla 1 iş; ücretli işlem 0 |
| **Çakışma alanı** | Aynı kaynak modülü hedefleyen iki madde aynı anda alınmaz. Her madde ayrı test dosyası yazar; guvenlik-test ile çakışma yok (o hat `supabase/` + rapor) |
| **Arayüz** | yok (görüntü n/a) |

**Kırmızı test kuralı:** Test yazarken mevcut davranışın bir bug olduğunu fark edersen testi "olması gereken"e göre yazma; mevcut davranışı kilitle, PR'ın "Kapsam dışı / açık soru" bölümüne yaz, kuyruğun `öneriler` bölümüne `app-kucuk-is` önerisi ekle. (ör. `profile.ts` owner_photos hata yutma — zaten `öneriler`'de.)

**Yüklenebilirlik kuralı:** Hedef modül README "Test kalıbı ve yüklenebilirlik"teki `vi.mock` kalıbıyla yüklenmiyorsa işi zorlamadan `takıldı: kapsam eksik → tech-lead` yaz.

**Gizli bağ kuralı:** Kuyruk maddesindeki "gizli bağ" (ör. T01 insert kolonları ↔ kolon grant'ı, T02 `coarsenCoordinates` ↔ SQL `round(…,2)`) testte yorumla anılır.
