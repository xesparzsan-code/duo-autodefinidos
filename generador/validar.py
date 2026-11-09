#!/usr/bin/env python3
"""Comprueba el banco de autodefinidos generado (src/data/puzzles.json)."""
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generar as G

ps = json.loads(G.SALIDA.read_text(encoding="utf-8"))
lex = G.cargar_lexico()
errores = []
ultimo = {}
dist_min = defaultdict(lambda: 10 ** 9)
usos = Counter()
longs = Counter()
for i, p in enumerate(ps):
    g = [["#" if ch == "#" else "." for ch in fila] for fila in p["filas"]]
    ts = set(G.tramos(g))
    vistos = set()
    palabras = []
    por_celda = Counter()
    textos = Counter()
    for c in p["pistas"]:
        t = (c["dir"], c["r"], c["c"], c["len"])
        if t not in ts:
            errores.append(f"#{p['n']}: pista sin tramo {t}")
        if t in vistos:
            errores.append(f"#{p['n']}: tramo con dos pistas {t}")
        vistos.add(t)
        w = "".join(p["filas"][c["r"]][c["c"] + k] if c["dir"] == "A" else p["filas"][c["r"] + k][c["c"]] for k in range(c["len"]))
        if w not in lex:
            errores.append(f"#{p['n']}: {w} no está en el léxico")
        elif c["texto"] not in lex[w]:
            errores.append(f"#{p['n']}: definición ajena para {w}")
        if p["filas"][c["cr"]][c["cc"]] != "#":
            errores.append(f"#{p['n']}: la casilla de definición no es '#'")
        if (c["cr"], c["cc"], c["flecha"]) not in G.candidatas(g, t):
            errores.append(f"#{p['n']}: flecha imposible para {w}")
        por_celda[(c["cr"], c["cc"])] += 1
        textos[c["texto"]] += 1
        palabras.append(w)
        longs[len(w)] += 1
    if vistos != ts:
        errores.append(f"#{p['n']}: tramos sin pista: {ts - vistos}")
    if max(por_celda.values()) > 2:
        errores.append(f"#{p['n']}: casilla con más de 2 definiciones")
    bloques = {(r, c) for r in range(p["h"]) for c in range(p["w"]) if p["filas"][r][c] == "#"}
    if bloques - set(por_celda):
        errores.append(f"#{p['n']}: casillas de definición vacías")
    if len(set(palabras)) != len(palabras):
        errores.append(f"#{p['n']}: palabra repetida en el mismo pasatiempo")
    if max(textos.values()) > 1:
        errores.append(f"#{p['n']}: definición repetida en el mismo pasatiempo")
    for w in palabras:
        if w in ultimo:
            dist_min[len(w)] = min(dist_min[len(w)], i - ultimo[w])
        ultimo[w] = i
        usos[w] += 1

print(f"{len(ps)} autodefinidos, {sum(longs.values())} palabras colocadas, {len(usos)} distintas")
print("Palabras por longitud:", dict(sorted(longs.items())))
print("Separación mínima entre repeticiones (en días), por longitud:", dict(sorted(dist_min.items())))
print("Más repetidas:", usos.most_common(8))
if errores:
    print("\n".join(errores[:30]))
    raise SystemExit(f"{len(errores)} errores")
print("Sin errores.")
