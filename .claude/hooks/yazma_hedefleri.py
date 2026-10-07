#!/usr/bin/env python3
"""otonom-guard yardımcısı: bir Bash komutunun YAZDIĞI yolları listeler (akış v1.4, 2026-10-07).

Neden: düz metin regex'i tırnak içindeki `>`/`<` karakterini (`sed 's#…#<url>#'`, `rg '<n>'`), `2>/dev/null`'u ve
`sed` okumasını yazma sanıyordu. Burada komut kabuk gibi ayrıştırılır; yalnız gerçek yazma hedefleri çıkar.

Çıktı: satır başına bir hedef. Emin olunamayan her durumda tek satır `?` (hook bu durumda eski, sıkı davranışa
döner: komutta korunan yol geçiyorsa engeller). Ayrıştırma hatası da `?`.
"""
from __future__ import annotations

import re
import shlex
import sys

SARMALAYICI = {"env", "command", "exec", "time", "nohup", "sudo", "nice"}
YAZAN = {"cp", "mv", "tee", "ln", "install", "truncate", "rm", "touch", "dd", "patch", "chmod", "chown",
         "unlink", "rsync", "rmdir", "shred"}
GIT_YAZAN = {"rm", "mv", "checkout", "restore", "apply", "am", "stash", "clean", "reset", "switch"}
YORUMLAYICI = {"python", "python3", "node", "ruby", "perl", "bun", "deno", "tsx", "php", "osascript"}
AYIRICI = {";", "&&", "||", "|", "&", "(", ")", "|&", ";;", "\n"}
YONLENDIR = {">", ">>", ">|", "&>", "&>>"}
BELIRSIZ_KARAKTER = re.compile(r"[$`*?\[{~]")


def segmentler(tokens: list[str]) -> list[list[str]]:
    seg, out = [], []
    for t in tokens:
        if t in AYIRICI:
            out.append(seg)
            seg = []
        else:
            seg.append(t)
    out.append(seg)
    return [s for s in out if s]


def analiz(cmd: str) -> set[str]:
    lex = shlex.shlex(cmd, posix=True, punctuation_chars=";&|<>()")
    lex.whitespace_split = True
    lex.commenters = ""
    tokens = list(lex)
    hedef: set[str] = set()
    cd_var = False
    for seg in segmentler(tokens):
        kelime: list[str] = []
        i = 0
        while i < len(seg):
            t = seg[i]
            if t in YONLENDIR or t == ">&":
                if i + 1 >= len(seg):
                    return {"?"}
                h = seg[i + 1]
                if not (h == "/dev/null" or (t == ">&" and h.isdigit()) or h.startswith("&")):
                    hedef.add(h)
                i += 2
                continue
            if t in {"<", "<<", "<<<", "<&"}:
                i += 2  # girdi; heredoc gövdesi ayrı satırlarda kelime olarak kalır (zararsız)
                continue
            kelime.append(t)
            i += 1
        # komut adı: değişken atamaları ve sarmalayıcılar atlanır
        j = 0
        while j < len(kelime) and (re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", kelime[j]) or kelime[j] in SARMALAYICI):
            j += 1
        if j >= len(kelime):
            continue
        ad, arg = kelime[j].rsplit("/", 1)[-1], kelime[j + 1:]
        if ad in {"cd", "pushd"}:
            cd_var = True
        elif ad == "xargs":
            if any(a.rsplit("/", 1)[-1] in YAZAN | {"sed", "perl"} for a in arg):
                return {"?"}
        elif ad in YAZAN:
            hedef.update(a for a in arg if not a.startswith("-"))
        elif ad in {"sed", "gsed"}:
            if any(re.match(r"^-[a-zA-Z]*i", a) or a.startswith("--in-place") for a in arg):
                hedef.update(a for a in arg if not a.startswith("-"))
        elif ad == "find":
            if any(a in {"-delete", "-exec", "-execdir", "-ok", "-okdir", "-fprint", "-fprintf", "-fls"} for a in arg):
                return {"?"}
        elif ad == "git":
            k, baska_dizin = 0, False
            while k < len(arg) and arg[k].startswith("-"):
                if arg[k] in {"-C", "-c", "--git-dir", "--work-tree"}:
                    baska_dizin |= arg[k] != "-c"
                    k += 1  # seçeneğin değeri
                k += 1
            alt = arg[k] if k < len(arg) else ""
            if alt in GIT_YAZAN:
                yollar = [a for a in arg[k + 1:] if not a.startswith("-")]
                if baska_dizin or alt in {"stash", "clean", "reset"} or not yollar:
                    return {"?"}  # çalışma ağacını toptan değiştirir ya da göreli yol belirsiz
                hedef.update(yollar)
        elif ad in {"awk", "gawk", "mawk"}:
            prog = " ".join(a for a in arg if not a.startswith("-"))
            if re.search(r"(print|printf)[^;{}]*>|system\s*\(|\|\s*\"", prog):
                return {"?"}
        elif ad in YORUMLAYICI:
            if any(a in {"-c", "-e", "-i", "-pi", "-pie", "-ni", "--eval"} or re.match(r"^-[a-zA-Z]*[ei]", a) for a in arg):
                return {"?"}
    if any(BELIRSIZ_KARAKTER.search(h) for h in hedef):
        return {"?"}
    if cd_var and any(not h.startswith("/") for h in hedef):
        return {"?"}
    return hedef


if __name__ == "__main__":
    try:
        print("\n".join(sorted(analiz(sys.argv[1]))))
    except Exception:  # noqa: BLE001 — ayrıştırılamayan komut: sıkı davranış
        print("?")
