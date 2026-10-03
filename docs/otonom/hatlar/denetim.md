# Hat: denetim

| Alan | Değer |
|---|---|
| **Durum** | açık |
| **Seviye** | L1 (yalnız rapor) |
| **Rol (zorunlu)** | auditor |
| **Amaç** | Kod değiştirmeyen, satır referanslı rapor: backlog/roadmap bayatlığı, drift (tip ↔ şema), kod denetimi bulgularının bugünkü durumu; doğrulanmış kuyruk stoku ve sahip kararı listesi |
| **Kapsam** | Okuma: tüm repo (L0 yollar dahil, yalnız okuma; `.env*`, `supabase/.temp/`, `.expo/`, `ios/` hariç). Yazma: yalnız `docs/otonom/raporlar/<tür>-<tarih>.md` ve kuyruk maddesinin durumu + `öneriler` |
| **Asla** | Kod/doküman/config değiştirmek (rapor içindeki kod blokları dosyaya yazılmaz); script çalıştırmak (yalnız `npm test`, `npm run typecheck`, `npm run lint`, `git log`, `git show`, `gh pr view/diff`, `rg`, `find`); metro/simülatör; canlı Supabase/Expo'ya bağlanmak; `gen:types`; secret değeri, proje ref'i, kişisel e-posta yazmak (public repo) |
| **Doğrulayıcı** | Rapor `oc/orchestrator/roller/auditor.md` çıktı formatında; her bulgu dosya:satır; "doğrulanmalı" etiketleri ayrı; kabul kriterindeki her başlık karşılanmış |
| **Çıktı** | Rapor dosyası, branch `otonom/denetim/<id>-<kisa-ad>` üzerinde taslak PR (ANAYASA §7.4); diff yalnız `docs/otonom/raporlar/` |
| **Onay kapısı** | yok (sahip okur; öneriler `hazır` olursa başka hatta iş olur) |
| **Bekleyen onay sınırı** | 2 okunmamış rapor (açık taslak PR) |
| **Bütçe** | günde 1 iş; ücretli işlem 0 |
| **Çakışma alanı** | yok (salt okuma) |
| **Arayüz** | yok; ekran gerektiren doğrulamalar "bilinmiyor (ekran gerekir)" yazılır |

**Girdi kuralı (D01):** backlog girdisi `origin/main`. PR #5 merge edilmemişse raporda not düşülür (kuyruk D01).

**Zaten raporlanmış riskler (tekrar raporlama, link ver):** `oc/orchestrator/audit/2026-10-03-kod-denetimi.md` §2 (10 bulgu), `oc/orchestrator/audit/2026-10-03-petmatch-kuyruk-onerisi.md` §1 (A17/A18/engelleme/hata yutma doğrulamaları).
