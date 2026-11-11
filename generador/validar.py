#!/usr/bin/env python3
"""Comprueba los autodefinidos de la carpeta autodefinidos/ (los que descarga la app).

Se ejecuta solo en GitHub cada vez que se edita un archivo, para avisar de errores
antes de que lleguen a los móviles. Uso: python3 generador/validar.py
"""
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generar as G

FLECHAS = {"right", "down", "right-down", "down-right", "left-down", "up-right"}
errores = []
total = 0
vistos_n = set()
for f in sorted(G.CARPETA.glob("[0-9]*.json")):
    total += 1
    nombre = f.name

    def mal(msg):
        errores.append(f"{nombre}: {msg}")

    try:
        d = json.loads(f.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        mal(f"no es JSON válido (línea {e.lineno}): {e.msg}")
        continue
    filas, pistas = d.get("filas"), d.get("pistas")
    if not isinstance(filas, list) or not isinstance(pistas, list) or not filas:
        mal("faltan 'filas' o 'pistas'")
        continue
    if d.get("n") != int(f.stem):
        mal(f"el campo n ({d.get('n')}) no coincide con el nombre del archivo")
    vistos_n.add(int(f.stem))
    ancho = len(filas[0])
    if any(len(x) != ancho for x in filas):
        mal("todas las filas deben tener la misma longitud")
        continue
    if any(ch != "#" and not G.VALIDA.match(ch) for x in filas for ch in x):
        mal("las filas solo pueden tener letras mayúsculas sin tilde (A-Z, Ñ) y '#'")
        continue
    alto = len(filas)
    g = [["#" if ch == "#" else "." for ch in x] for x in filas]
    # tramos de 2+ letras que deben tener definición
    tramos = set()
    for r in range(alto):
        c = 0
        while c < ancho:
            if g[r][c] == ".":
                ini = c
                while c < ancho and g[r][c] == ".":
                    c += 1
                if c - ini >= 2:
                    tramos.add(("A", r, ini, c - ini))
            else:
                c += 1
    for c in range(ancho):
        r = 0
        while r < alto:
            if g[r][c] == ".":
                ini = r
                while r < alto and g[r][c] == ".":
                    r += 1
                if r - ini >= 2:
                    tramos.add(("D", ini, c, r - ini))
            else:
                r += 1
    usados = set()
    por_celda = Counter()
    for p in pistas:
        try:
            palabra, texto, dr, r, c, cr, cc, flecha = (p[k] for k in ("palabra", "texto", "dir", "r", "c", "cr", "cc", "flecha"))
        except KeyError as e:
            mal(f"a una pista le falta el campo {e}")
            continue
        t = (dr, r, c, len(palabra))
        if t not in tramos:
            mal(f"{palabra}: no hay una palabra de {len(palabra)} letras en ese sitio de la rejilla")
            continue
        if t in usados:
            mal(f"{palabra}: palabra con dos definiciones")
        usados.add(t)
        real = "".join(filas[r][c + k] if dr == "A" else filas[r + k][c] for k in range(len(palabra)))
        if real != palabra:
            mal(f"'palabra' dice {palabra} pero en la rejilla pone {real}")
        if not isinstance(texto, str) or not texto.strip():
            mal(f"{palabra}: definición vacía")
        elif len(texto) > 40:
            mal(f"{palabra}: definición demasiado larga ({len(texto)} caracteres, máximo 40)")
        if flecha not in FLECHAS:
            mal(f"{palabra}: flecha desconocida '{flecha}'")
        if not (0 <= cr < alto and 0 <= cc < ancho) or filas[cr][cc] != "#":
            mal(f"{palabra}: la casilla de definición ({cr},{cc}) no es '#'")
        else:
            ok = {"A": {(r, c - 1): "right", (r - 1, c): "down-right", (r + 1, c): "up-right"},
                  "D": {(r - 1, c): "down", (r, c - 1): "right-down", (r, c + 1): "left-down"}}[dr]
            if ok.get((cr, cc)) != flecha:
                mal(f"{palabra}: la flecha '{flecha}' no encaja con su casilla de definición")
        por_celda[(cr, cc)] += 1
    for t in tramos - usados:
        mal(f"hay una palabra sin definición en fila {t[1]}, columna {t[2]} ({'horizontal' if t[0] == 'A' else 'vertical'})")
    if por_celda and max(por_celda.values()) > 2:
        mal("una casilla tiene más de 2 definiciones")

if vistos_n != set(range(1, total + 1)):
    errores.append("los archivos deben ir numerados seguidos: 0001.json, 0002.json…")
try:
    idx = json.loads((G.CARPETA / "indice.json").read_text(encoding="utf-8"))
    if idx.get("total") != total:
        errores.append(f"indice.json dice total={idx.get('total')} pero hay {total} autodefinidos")
except (OSError, json.JSONDecodeError):
    errores.append("falta indice.json o no es válido")

print(f"{total} autodefinidos revisados")
if errores:
    print("\n".join(errores[:40]))
    raise SystemExit(f"{len(errores)} errores")
print("Sin errores.")
