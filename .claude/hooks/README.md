# `.claude/` — Claude Code izinleri ve guard (oc F4/F9, denetim 2026-10-25)

**Amaç:** sahip etkileşimli oturumda çalışırken ajan **mevcut dala tıklamasız push** edebilsin ve PR açabilsin; `main`'e push ve force her oturumda kapalı kalsın; otonom döngü (`_otonom/petmatch/merkez`) tam korumayı korusun.

| Parça | Ne yapar |
|---|---|
| `settings.json` `allow` | `git push -u origin HEAD` / `git push origin HEAD` / `gh pr create|view|list|checks` izin istemi çıkarmaz |
| `settings.json` `deny` | `main`'e push (her biçim), force, `gh pr merge` → oturum ne olursa olsun reddedilir (deny > allow) |
| `hooks/otonom-guard.sh` | Canonical şablon: `oc/orchestrator/guardrails/otonom-guard.sh` (sürüm `OTONOM_GUARD_SURUM`). **İki mod:** çalışma dizini `_otonom/` altındaysa TAM (yalnız `otonom/*`'a push, deploy/sır/sistem yasakları, `EK_YASAK`); değilse ANA-DAL (yalnız `main`+force). `HEAD` push'u mevcut dal `main` ise de engellenir. |

`EK_YASAK` (TAM modda, bu repoya özel): petmatch — repos.yaml harita.tehlikeli + gorev-petmatch.md 'Kesin yasaklar' (QA script'leri prod'a yazar; test:db serbest)

Kopyayı güncelleme: `cp oc/orchestrator/guardrails/otonom-guard.sh .claude/hooks/` + `EK_YASAK` bloğunu koru; test: `bash oc/orchestrator/guardrails/otonom-guard.test.sh .claude/hooks/otonom-guard.sh`.

Otonom worktree'deki `settings.local.json` (deny listesi) bu dosyanın **üstüne** biner; `_otonom/petmatch/merkez/.claude/hooks/otonom-guard.sh` kopyası varsa silinir, bu ortak dosya kullanılır. Kişisel ek izinler `settings.local.json`'a (git dışı).
