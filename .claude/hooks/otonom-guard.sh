#!/usr/bin/env bash
# Etkin: yalnız petmatch otonom worktree'leri (merkez, is) — ANAYASA §10. teacher-mvp otonom-guard.sh (bd514d9, push segmenti) uyarlaması.
# PreToolUse(Bash) ikinci savunma hattı: deny listesindeki kalıp eşleşmesi kaçırırsa burada yakalanır.
# Girdi: stdin'de tool çağrısı JSON'u. Çıkış 2 = engelle (stderr ajana gösterilir). Bu dosya değiştirilmez (README: guard aşma yasağı).
set -euo pipefail
cmd="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))')"
block(){ echo "otonom-guard: engellendi — $1. Bkz. docs/otonom/README.md (L0)." >&2; exit 2; }
S='(^|[;&|(`[:space:]])'   # komut başı / ayırıcı
E='([[:space:]]|$)'
# Komut konumu: satır başı ya da ayırıcıdan sonra; isteğe bağlı sarmalayıcılar (env/command/exec/xargs/time/nohup/sudo)
# ve paket çalıştırıcılar (npx/pnpm dlx/yarn dlx/bunx/node_modules/.bin/). `rg supabase core/` gibi argümanlar engellenmez.
C='(^|[;&|(`]|\$\()[[:space:]]*((env|command|exec|xargs|time|nohup|sudo)[[:space:]]+|[A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*((npx|bunx)[[:space:]]+(-y[[:space:]]+|--yes[[:space:]]+)?|(pnpm|yarn)[[:space:]]+(dlx[[:space:]]+)?|(\./)?node_modules/\.bin/)?'

# 1. git push: ana branch, force, otonom/* dışı hedef (main korumasız — A22 sahipte)
# Kontroller yalnız push segmentine bakar (`git … push …` ayırıcıya kadar); zincirdeki `gh pr create --base main` push sayılmaz (teacher-mvp 2026-10-03 yanlış pozitifi).
if [[ "$cmd" =~ ${S}git[[:space:]]([^;&|]*[[:space:]])?push${E} ]]; then
  while IFS= read -r seg; do
    [[ -z "$seg" ]] && continue
    [[ "$seg" =~ (^|[[:space:]:/+])(main|master)([[:space:]]|$) ]]                   && block "ana branch'e push"
    [[ "$seg" =~ [[:space:]](--force|-f|--force-with-lease|--mirror|--all|--delete|-d)${E} || "$seg" =~ [[:space:]]\+ || "$seg" =~ [[:space:]]: ]] && block "force/silme/toplu push"
    [[ "$seg" != *"otonom/"* ]]                                                      && block "push yalnız otonom/* branch'lerine"
  done < <(python3 -c 'import re,sys; print("\n".join(m.group(0) for m in re.finditer(r"git\s[^;&|]*?\bpush\b[^;&|]*", sys.argv[1])))' "$cmd")
fi
# 2. merge yalnız sahipte
[[ "$cmd" =~ ${S}gh[[:space:]]+pr[[:space:]]+merge ]] && block "merge yalnız sahipte"
# 3. Supabase CLI her biçim (db push, link, login, functions deploy, migration repair, start, gen types …) — kök checkout canlı projeye bağlı
[[ "$cmd" =~ ${C}supabase${E} ]] && block "Supabase CLI (canlı proje)"
# 4. EAS / Expo build-submit-start, native build
[[ "$cmd" =~ ${C}(eas|eas-cli|expo)${E} ]] && block "EAS / Expo CLI"
[[ "$cmd" =~ ${C}(xcodebuild|pod|fastlane)${E} ]] && block "native build / yayın"
[[ "$cmd" =~ npm[[:space:]]+(run[[:space:]]+)?(start|web|ios|android)${E} ]] && block "metro/uygulama başlatma (canlı Supabase)"
# 5. scripts/ seed/reset/gen ve canlıya giden npm script'leri (yalnız `npm run test:db` serbest)
[[ "$cmd" =~ npm[[:space:]]+run[[:space:]]+(db:|local:|seed:|reset:|gen:) ]] && block "canlı DB / seed / reset / gen:types"
X='(^|[;&|(]|\$\()[[:space:]]*\./scripts/'
[[ "$cmd" =~ ${S}(node|bun|deno|tsx|bash|sh|zsh)[[:space:]]+(\./)?scripts/ || "$cmd" =~ $X ]] && block "scripts/ doğrudan çalıştırma (yalnız npm run test:db)"
[[ "$cmd" =~ (seed-qa|reset-qa|gen-supabase-types) && ! "$cmd" =~ ^[[:space:]]*(rg|grep|cat|head|tail|sed[[:space:]]+-n|wc|git[[:space:]]+(log|show|diff|blame))[[:space:]] ]] && block "QA seed/reset / tip üretimi (canlı)"
# 6. GitHub Actions / secret / repo ayarı
[[ "$cmd" =~ ${S}gh[[:space:]]+workflow[[:space:]]+(run|enable) ]] && block "gh workflow run (supabase-keep-alive = prod isteği)"
[[ "$cmd" =~ ${S}gh[[:space:]]+(secret|variable)${E} ]] && block "gh secret/variable"
[[ "$cmd" =~ ${S}gh[[:space:]]+api[[:space:]].*(-X|--method)[[:space:]]*(PUT|POST|PATCH|DELETE) || "$cmd" =~ ${S}gh[[:space:]]+api[[:space:]].*[[:space:]](-f|-F|--field|--raw-field|--input)${E} ]] && block "gh api yazma isteği"
# 7. .env erişimi (process.env gibi kod ifadeleri hariç) ve canlı adresler
[[ "$cmd" =~ (^|[^a-zA-Z0-9_])\.env ]] && block ".env erişimi"
[[ "$cmd" == *supabase.co* || "$cmd" == *api.supabase.com* || "$cmd" == *expo.dev* || "$cmd" == *exp.host* ]] && block "canlı servis adresi"
[[ "$cmd" == *supabase/.temp* && ! "$cmd" =~ ^[[:space:]]*find[[:space:]] ]] && block "supabase/.temp (proje ref'i)"
[[ "$cmd" == *"/.supabase"* ]] && block "~/.supabase (CLI oturumu)"
# 8. Docker yalnız `npm run test:db` üzerinden (sabit petmatch_test_db kilidi)
[[ "$cmd" =~ ${C}(docker|docker-compose|colima|podman)${E} ]] && block "docker doğrudan (yalnız npm run test:db)"
# 9. Edge deploy
[[ "$cmd" =~ ${C}(deno[[:space:]]+deploy|deployctl)${E} ]] && block "edge deploy"
# 10. supabase/{migrations,functions,tests} içine Bash ile yazma — tek istisna supabase/tests/zz_otonom_* (README kırmızı koşu)
W="${S}(cp|mv|tee|ln|install|truncate|rm|touch|dd|patch)${E}|${S}(sed|perl)[[:space:]]+-[a-zA-Z]*i|(^|[^0-9=!<>-])[0-9]*>{1,2}[[:space:]]*[^=&>[:space:][:digit:]]"
# -m/--body/--title metinleri ayıklanır: PR yorumunda yol anmak yazma değildir (2026-10-05 yanlış pozitifi)
body_free="$(python3 -c '
import re,sys
c=sys.argv[1]
c=re.sub(r"(?:^|\s)(?:-m|-t|-b|--title|--body|--message)(?:\s+|=)(\"(?:[^\"\\]|\\.)*\"|'"'"'[^'"'"']*'"'"')","",c)
print(c)' "$cmd")"
if [[ "$body_free" =~ supabase/(migrations|functions|tests)/ && "$body_free" =~ $W ]]; then
  rest="$(python3 -c 'import re,sys; print(re.sub(r"supabase/tests/zz_otonom_[A-Za-z0-9_-]+\.test\.sql","",sys.argv[1]))' "$body_free")"
  [[ "$rest" =~ supabase/(migrations|functions|tests)/ ]] && block "supabase/ şema/fonksiyon/test dosyasına yazma (yalnız zz_otonom_* geçici test)"
fi
# Ek: kabuk içinden komut (guard aşma yolu) ve bağımlılık ekleme
[[ "$cmd" =~ ${C}(bash|sh|zsh)[[:space:]]+-[a-zA-Z]*c || "$cmd" =~ ${C}eval${E} ]] && block "bash -c / eval (komutu doğrudan yaz)"
[[ "$cmd" =~ ${S}npm[[:space:]]+(install|i|add)${E} ]] && block "bağımlılık ekleme (yalnız npm ci)"
exit 0
