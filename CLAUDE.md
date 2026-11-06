# petmatch — Claude Code

## Otonom döngü ile paralel çalışma (OC ANAYASA §10)

Bu repoda zamanlanmış bir otonom döngü de çalışır (`~/otonom/petmatch/{merkez,is}`, `otonom/*` branch'leri, Telegram onaylı). Elle açılan Claude oturumları:
1. **`~/otonom/` altında açılmaz.** Çalışma yeri ana klasör `~/Desktop/cursor_claude/petmatch/` ya da `~/Desktop/cursor_claude/_worktrees/petmatch-<iş>/`.
2. **`otonom/*` branch'lerine commit/push etmez, döngünün PR'larını merge etmez.** Onlar akşam toplu merge butonuyla ya da sahip tarafından merge edilir.
3. **İşe güncel `origin/main`'dan başlar** (`git fetch` → yeni branch ya da rebase); yalnız PR ile döner, `main`'a doğrudan push etmez.
4. Döngünün kuyruğundaki (`docs/otonom/kuyruk.md`, `otonom/merkez` branch'i) bir maddeyi elle yapıyorsan sahibe söyle; kuyruğa `sahip+claude yapıyor` notu düşülür, döngü o maddeyi almaz.
