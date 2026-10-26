#!/usr/bin/env bash
# otonom-guard.sh — PreToolUse(Bash) hook şablonu, canonical (ANAYASA §10; denetim 2026-10-25 §1-3).
# Repolar bunu kopyalamaz; `_otonom/<repo>/merkez/.claude/hooks/otonom-guard.sh` olarak kurulur ve
# oc'deki sürümle aynı tutulur (sürüm satırı aşağıda; check-map karşılaştırır). Repoya özel ek yasaklar
# EK_YASAK dizisine, kopyanın başındaki tek blokta eklenir.
#
# Davranış:
#   - İki mod (F9, denetim 2026-10-25 §3-1):
#       TAM   : çalışma dizini `_otonom/` altında (otonom döngü) → aşağıdaki tüm kurallar.
#       ANA-DAL: başka her yerde (sahibin etkileşimli oturumu, repo kökü) → YALNIZ ana dala (main/master) push ve
#               force push engellenir; `otonom/*` dışı dallara push, PR açma, build vb. SERBESTTİR. Böylece hook
#               repo köküne commit'li kurulabilir ve sahip çalışırken "kendisi push edemiyor" sorunu kalmaz.
#     Test için OTONOM_GUARD_FORCE=1 (TAM), OTONOM_GUARD_FORCE=anadal (ANA-DAL).
#   - Komutu `&&`, `||`, `;`, `|`, satır sonu ile SEGMENTLERE böler; heredoc gövdeleri ve tırnaklı metinler
#     eşleşmeden ÖNCE silinir (kuyruk/rapor yazan heredoc'ta "gh pr merge" geçmesi yanlış pozitif üretmez).
#   - Kural her segmentin BAŞINA bakar (zincirdeki `--base main` argümanı push kuralını tetiklemez).
#   - git push: yalnız `otonom/*` dalına (açıkça ya da HEAD mevcut dal otonom/* ise). Force her biçimde yasak.
#   - `with-secrets NAME=ENV -- cmd` sarmalayıcısı delinir: kurallar `cmd`'ye uygulanır (F10).
#   - Engellenince stderr'e "otonom-guard: engellendi: <kural> — <segment>" ve exit 2.
# Girdi: stdin'de Claude Code hook JSON'u ({"tool_input":{"command":"..."}}).
OTONOM_GUARD_SURUM=3

# --- repoya özel ek yasaklar (yalnız bu blok düzenlenir; düzenli ifade, segment başına uygulanır) ---
EK_YASAK=(   # petmatch — repos.yaml harita.tehlikeli + gorev-petmatch.md 'Kesin yasaklar' (QA script'leri prod'a yazar; test:db serbest)
  '^(npm|pnpm|yarn) +run +(db:|local:|gen:types|seed:|reset:)'
  '^(node|npx|tsx) +scripts/(gen-supabase-types|reset-qa-discovery|seed-qa-pet-photos)'
  '^(npm|pnpm|yarn) +(start|run +(web|ios|android))( |$)'
  '^(npx +)?(expo|xcodebuild|pod)( |$)'
  '^(npm|pnpm|yarn) +(install|i|add)( |$)'
  '^(cat|sed|tee|vim|nano) .*\b(eas|app)\.json\b'
)
# --------------------------------------------------------------------------------------------

set -u

MOD=anadal
case "${OTONOM_GUARD_FORCE:-0}" in
  1) MOD=tam ;;
  anadal) MOD=anadal ;;
  *) [[ "$PWD" == */_otonom/* ]] && MOD=tam ;;
esac

cmd="$(python3 -c 'import json,sys
try:
    print(json.load(sys.stdin).get("tool_input",{}).get("command",""))
except Exception:
    print("")' 2>/dev/null)"
[[ -n "$cmd" ]] || exit 0

engelle() { echo "otonom-guard: engellendi: $1 — $2" >&2; exit 2; }

# 1. heredoc gövdelerini sil (<<EOF … EOF, <<'EOF', <<-EOF), 2. tırnaklı metinleri sil, 3. segmentlere böl
temiz="$(printf '%s\n' "$cmd" | python3 -c '
import re,sys
s=sys.stdin.read()
out=[];i=0;lines=s.split("\n")
while i<len(lines):
    m=re.search(r"<<-?\s*[\x27\"]?([A-Za-z_][A-Za-z0-9_]*)[\x27\"]?",lines[i])
    if m:
        out.append(lines[i][:m.start()]+" <<HEREDOC")
        tag=m.group(1); i+=1
        while i<len(lines) and lines[i].strip()!=tag: i+=1
    else:
        out.append(lines[i])
    i+=1
s="\n".join(out)
s=re.sub(r"\x27[^\x27]*\x27","\x27\x27",s)
s=re.sub(r"\"[^\"]*\"","\"\"",s)
for seg in re.split(r"&&|\|\||;|\||\n",s):
    seg=seg.strip()
    seg=re.sub(r"^(sudo|env|time|nice|nohup|command)\s+","",seg)
    seg=re.sub(r"^[A-Za-z_][A-Za-z0-9_]*=\S*\s+","",seg)   # FOO=bar cmd
    seg=re.sub(r"^(\S*/)?with-secrets\s+.*?\s--\s+","",seg)   # with-secrets … -- CMD → CMD (sarmalayıcı yetki vermez)
    if seg: print(seg)
')"

mevcut_dal() { git branch --show-current 2>/dev/null || true; }

while IFS= read -r seg; do
  [[ -n "$seg" ]] || continue

  # --- git push: yalnız otonom/* ---
  if [[ "$seg" =~ ^git[[:space:]]+(-C[[:space:]]+[^[:space:]]+[[:space:]]+)?push([[:space:]]|$) ]]; then
    [[ "$seg" =~ (^|[[:space:]])(-f|--force|--force-with-lease(=[^[:space:]]*)?|--force-if-includes|-[a-zA-Z]*f[a-zA-Z]*)([[:space:]]|$) ]] && engelle "git push force" "$seg"
    [[ "$seg" =~ [[:space:]]\+[^[:space:]] ]] && engelle "git push +refspec (force)" "$seg"
    [[ "$seg" =~ --(delete|prune)([[:space:]]|$) ]] && engelle "git push --delete" "$seg"
    [[ "$seg" =~ --mirror|--all([[:space:]]|$) ]] && engelle "git push --all/--mirror" "$seg"
    # refspec'ler: seçeneksiz argümanlardan ilki remote, kalanı refspec
    read -ra parca <<<"$seg"
    refs=(); remote=""
    skip=0
    for ((i=1;i<${#parca[@]};i++)); do
      p="${parca[$i]}"
      [[ "$p" == "push" ]] && continue
      if (( skip )); then skip=0; continue; fi
      case "$p" in
        -C|-o|--push-option|--receive-pack|--exec|--repo) skip=1; continue ;;
        -*) continue ;;
      esac
      if [[ -z "$remote" ]]; then remote="$p"; else refs+=("$p"); fi
    done
    # hedef dal(lar)ı topla: refspec yoksa ya da HEAD ise mevcut dal
    hedefler=()
    if (( ${#refs[@]} == 0 )); then
      hedefler+=("$(mevcut_dal)")
    else
      for r in "${refs[@]}"; do
        hedef="${r#*:}"; src="${r%%:*}"; hedef="${hedef#refs/heads/}"
        if [[ "$hedef" == "HEAD" || ( "$r" != *:* && "$src" == "HEAD" ) ]]; then hedefler+=("$(mevcut_dal)"); else hedefler+=("$hedef"); fi
      done
    fi
    for h in "${hedefler[@]}"; do
      [[ "$h" == main || "$h" == master || -z "$h" ]] && engelle "ana dala push (${h:-dal yok})" "$seg"
      [[ "$MOD" == tam && "$h" != otonom/* ]] && engelle "git push: hedef dal otonom/* değil ($h)" "$seg"
    done
    continue
  fi
  [[ "$MOD" == anadal ]] && continue   # ANA-DAL modunda push dışı kural yok

  # --- git: geri alınamaz / paylaşılan dal ---
  [[ "$seg" =~ ^git[[:space:]]+(-C[[:space:]]+[^[:space:]]+[[:space:]]+)?(reset[[:space:]]+--hard|rebase|branch[[:space:]]+(-D|--delete[[:space:]]+--force)|filter-branch|filter-repo) ]] && engelle "git geri alınamaz" "$seg"
  [[ "$seg" =~ ^git[[:space:]]+(-C[[:space:]]+[^[:space:]]+[[:space:]]+)?(checkout|switch)[[:space:]]+(main|master)([[:space:]]|$) ]] && engelle "ana dala geçiş" "$seg"
  [[ "$seg" =~ ^git[[:space:]]+(-C[[:space:]]+[^[:space:]]+[[:space:]]+)?merge[[:space:]] && ! "$seg" =~ origin/(main|master)|orchestrator/ ]] && engelle "git merge (yalnız origin/main → merkez)" "$seg"

  # --- gh: merge, silme, workflow, secret, yazan api ---
  [[ "$seg" =~ ^gh[[:space:]]+pr[[:space:]]+(merge|close)([[:space:]]|$) ]] && engelle "gh pr merge/close" "$seg"
  [[ "$seg" =~ ^gh[[:space:]]+pr[[:space:]]+ready([[:space:]]|$) ]] && engelle "gh pr ready (taslak kalır)" "$seg"
  [[ "$seg" =~ ^gh[[:space:]]+repo[[:space:]]+(delete|archive|rename|edit)([[:space:]]|$) ]] && engelle "gh repo yazma" "$seg"
  [[ "$seg" =~ ^gh[[:space:]]+(workflow[[:space:]]+run|run[[:space:]]+(rerun|cancel)|secret|variable|release)([[:space:]]|$) ]] && engelle "gh workflow/secret/release" "$seg"
  [[ "$seg" =~ ^gh[[:space:]]+api[[:space:]] && "$seg" =~ (-X[[:space:]]*(POST|PUT|PATCH|DELETE)|--method[[:space:]=]*(POST|PUT|PATCH|DELETE)|(^|[[:space:]])(-f|-F|--field|--raw-field|--input)([[:space:]]|$)) ]] && engelle "gh api yazma" "$seg"

  # --- deploy / prod / ücretli ---
  [[ "$seg" =~ ^(npx[[:space:]]+)?(supabase|eas|vercel|wrangler|fly|flyctl|heroku|firebase|gcloud|aws|az|doctl|railway)([[:space:]]|$) ]] && engelle "deploy/prod CLI" "$seg"
  [[ "$seg" =~ ^(npx[[:space:]]+)?expo[[:space:]]+(publish|export|run:|build|submit|prebuild) ]] && engelle "expo yayın/build" "$seg"
  [[ "$seg" =~ ^(npx[[:space:]]+)?prisma[[:space:]]+(migrate|db[[:space:]]+push) ]] && engelle "prisma prod şema" "$seg"
  [[ "$seg" =~ ^deno[[:space:]]+deploy ]] && engelle "deno deploy" "$seg"
  [[ "$seg" =~ ^(npm|pnpm|yarn|bun)[[:space:]]+(publish|run[[:space:]]+(deploy|publish|release|submit)) ]] && engelle "paket/deploy script" "$seg"

  # --- sistem / ağ ---
  [[ "$seg" =~ ^(ssh|scp|sftp|rsync|docker|docker-compose|colima|podman|systemctl|crontab|launchctl|sudo)([[:space:]]|$) ]] && engelle "sistem/uzak erişim" "$seg"
  [[ "$seg" =~ ^rm[[:space:]]+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r) ]] && engelle "rm -rf" "$seg"
  [[ "$seg" =~ api\.telegram\.org ]] && engelle "Telegram API doğrudan (bin/notify kullan)" "$seg"

  # --- sırlar: okuma yolu ve kasa ---
  [[ "$seg" =~ (^|[[:space:]/])\.env(\.[A-Za-z0-9_.-]+)?([[:space:]]|$) && ! "$seg" =~ \.env\.example ]] && engelle ".env dosyası" "$seg"
  [[ "$seg" =~ (^|[[:space:]])(security[[:space:]]+find-(generic|internet)-password|op[[:space:]]+(read|item[[:space:]]+get)|gh[[:space:]]+auth[[:space:]]+token) ]] && engelle "kasa okuma (with-secrets kullan)" "$seg"
  [[ "$seg" =~ (^|[[:space:]])(printenv|env)([[:space:]]|$) && "$seg" =~ (TOKEN|KEY|SECRET|PASS) ]] && engelle "env dökümü" "$seg"
  [[ "$seg" =~ (^|[[:space:]])(cat|less|more|head|tail|bat)[[:space:]].*(credentials|auth-profiles|\.ssh/[^[:space:]]*|[^[:space:]]*\.(pem|key))([[:space:]]|$) ]] && engelle "kimlik dosyası okuma" "$seg"

  # --- repoya özel ---
  for re in "${EK_YASAK[@]:-}"; do
    [[ -n "$re" && "$seg" =~ $re ]] && engelle "repo kuralı ($re)" "$seg"
  done
done <<<"$temiz"

exit 0
