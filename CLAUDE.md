# petmatch — Claude Code

## Otonom döngü ile paralel çalışma (OC ANAYASA §10)

Bu repoda zamanlanmış bir otonom döngü de çalışır (`~/otonom/petmatch/{merkez,is}`, `otonom/*` branch'leri, Telegram onaylı). Elle açılan Claude oturumları:
1. **`~/otonom/` altında açılmaz.** Çalışma yeri ana klasör `~/Desktop/cursor_claude/petmatch/` ya da `~/Desktop/cursor_claude/_worktrees/petmatch-<iş>/`.
2. **`otonom/*` branch'lerine commit/push etmez, döngünün PR'larını merge etmez.** Onlar akşam toplu merge butonuyla ya da sahip tarafından merge edilir.
3. **İşe güncel `origin/main`'dan başlar** (`git fetch` → yeni branch ya da rebase); yalnız PR ile döner, `main`'a doğrudan push etmez.
4. Döngünün kuyruğundaki (`docs/otonom/kuyruk.md`, `otonom/merkez` branch'i) bir maddeyi elle yapıyorsan sahibe söyle; kuyruğa `sahip+claude yapıyor` notu düşülür, döngü o maddeyi almaz.

## PR ve CI tasarrufu (2026-11-08)

GitHub Actions kotası sınırlı (ücretsiz plan, tüm repolar ortak). Kurallar:
- **Küçük değişiklikleri tek PR'da topla.** Aynı konudaki düzeltmeleri, belge güncellemelerini ve ufak fix'leri ayrı PR'lar yerine bir PR'da birleştir; bir oturumda hedef ≤2 PR. PR açmadan önce "bu, az önceki PR'ın devamı mı?" diye sor — öyleyse aynı branch'e commit'le.
- **Belge-yalnız değişiklikler CI çalıştırmaz** (`*.md`, `docs/`, `.claude/`); bunları kod PR'ına ekle ya da biriktir.
- **Taslak PR'da CI çalışmaz.** PR'ı "ready" yapmadan önce yerelde typecheck + test geç; CI tek seferde yeşil olsun. Üst üste küçük düzeltme push'ları eski koşuyu iptal eder ama dakikayı geri vermez.
- `main`'e merge sonrası ayrı CI koşusu yok; `main` her gece bir kez doğrulanır. Merge öncesi PR CI'ı yeşil olmalı.
