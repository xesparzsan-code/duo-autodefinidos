#!/usr/bin/env python3
"""Generador de autodefinidos.

Uso:  python3 generador/generar.py [cantidad] [semilla]

Lee el léxico de generador/lexico/*.txt y escribe src/data/puzzles.json.
Cada autodefinido es una rejilla de 8x11 con casillas de definición ('#')
que apuntan con flechas a las palabras, como en los de los diarios.
"""
import json
import random
import re
import sys
import time
from collections import defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
SALIDA = RAIZ.parent / "src" / "data" / "puzzles.json"
CARPETA = RAIZ.parent / "autodefinidos"

W, H = 8, 11
MAXLEN = 8
MAX_DOS_LETRAS = 4
# Nº mínimo de autodefinidos que deben pasar antes de repetir una palabra, según su longitud
SEPARACION = {2: 2, 3: 5, 4: 12, 5: 30, 6: 40, 7: 40, 8: 40}
MAX_TEXTO = 34

VALIDA = re.compile(r"^[A-ZÑ]+$")


def leer_archivo(f):
    for linea in f.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#") or "(no)" in linea or ":" not in linea:
            continue
        palabra, resto = linea.split(":", 1)
        palabra = palabra.strip().upper()
        pistas = [p.strip() for p in resto.split("|") if p.strip()]
        if not VALIDA.match(palabra) or not (2 <= len(palabra) <= MAXLEN) or not pistas:
            continue
        for p in pistas:
            if len(p) > MAX_TEXTO:
                raise SystemExit(f"Definición demasiado larga ({len(p)}): {palabra}: {p}")
            if len(palabra) > 3 and palabra.lower() in re.findall(r"[a-zñ]+", quitar_tildes(p.lower())):
                raise SystemExit(f"La definición contiene la respuesta: {palabra}: {p}")
        yield palabra, pistas


def cargar_lexico():
    """Léxico base y, encima, las definiciones exigentes de dificil-*.txt (tienen prioridad)."""
    lex = {}
    archivos = sorted((RAIZ / "lexico").glob("*.txt"))
    for f in archivos:
        if f.name.startswith("dificil"):
            continue
        for palabra, pistas in leer_archivo(f):
            lex.setdefault(palabra, pistas)
    for f in archivos:
        if not f.name.startswith("dificil"):
            continue
        for palabra, pistas in leer_archivo(f):
            if palabra in lex:
                lex[palabra] = pistas
    return lex


def quitar_tildes(s):
    return s.translate(str.maketrans("áéíóúü", "aeiouu"))


# ---------------------------------------------------------------- patrón

def patron_base():
    g = [["." for _ in range(W)] for _ in range(H)]
    for c in range(0, W, 2):
        g[0][c] = "#"
    for r in range(0, H, 2):
        g[r][0] = "#"
    return g


def tramos(g):
    """Devuelve las palabras (tramos de 2+ casillas blancas): (dir, r, c, len)."""
    res = []
    for r in range(H):
        c = 0
        while c < W:
            if g[r][c] == ".":
                ini = c
                while c < W and g[r][c] == ".":
                    c += 1
                if c - ini >= 2:
                    res.append(("A", r, ini, c - ini))
            else:
                c += 1
    for c in range(W):
        r = 0
        while r < H:
            if g[r][c] == ".":
                ini = r
                while r < H and g[r][c] == ".":
                    r += 1
                if r - ini >= 2:
                    res.append(("D", ini, c, r - ini))
            else:
                r += 1
    return res


def es_bloque(g, r, c):
    return 0 <= r < H and 0 <= c < W and g[r][c] == "#"


def candidatas(g, tramo):
    """Casillas de definición que pueden apuntar a un tramo, con su tipo de flecha."""
    d, r, c, _ = tramo
    res = []
    if d == "A":
        if es_bloque(g, r, c - 1):
            res.append((r, c - 1, "right"))
        if es_bloque(g, r - 1, c):
            res.append((r - 1, c, "down-right"))
        if es_bloque(g, r + 1, c):
            res.append((r + 1, c, "up-right"))
    else:
        if es_bloque(g, r - 1, c):
            res.append((r - 1, c, "down"))
        if es_bloque(g, r, c - 1):
            res.append((r, c - 1, "right-down"))
        if es_bloque(g, r, c + 1):
            res.append((r, c + 1, "left-down"))
    return res


def asignar_definiciones(g, ts):
    """Empareja cada tramo con una casilla de definición (máx. 2 por casilla)."""
    carga = defaultdict(list)
    asign = {}

    def colocar(i, visto):
        for (r, c, flecha) in candidatas(g, ts[i]):
            if (r, c) in visto:
                continue
            visto.add((r, c))
            if len(carga[(r, c)]) < 2:
                carga[(r, c)].append(i)
                asign[i] = (r, c, flecha)
                return True
            for j in list(carga[(r, c)]):
                if colocar_otro(j, (r, c), visto):
                    carga[(r, c)].remove(j)
                    carga[(r, c)].append(i)
                    asign[i] = (r, c, flecha)
                    return True
        return False

    def colocar_otro(j, evitar, visto):
        for (r, c, flecha) in candidatas(g, ts[j]):
            if (r, c) == evitar or (r, c) in visto:
                continue
            visto.add((r, c))
            if len(carga[(r, c)]) < 2:
                carga[(r, c)].append(j)
                asign[j] = (r, c, flecha)
                return True
            for k in list(carga[(r, c)]):
                if colocar_otro(k, (r, c), visto):
                    carga[(r, c)].remove(k)
                    carga[(r, c)].append(j)
                    asign[j] = (r, c, flecha)
                    return True
        return False

    for i in range(len(ts)):
        if not colocar(i, set()):
            return None
    return asign


def patron_valido(g):
    ts = tramos(g)
    if any(t[3] > MAXLEN for t in ts):
        return None
    if sum(1 for t in ts if t[3] == 2) > MAX_DOS_LETRAS:
        return None
    # cada casilla blanca interior debe cruzarse en las dos direcciones
    enA, enD = set(), set()
    for d, r, c, n in ts:
        for k in range(n):
            (enA if d == "A" else enD).add((r, c + k) if d == "A" else (r + k, c))
    for r in range(H):
        for c in range(W):
            if g[r][c] != ".":
                continue
            a, dd = (r, c) in enA, (r, c) in enD
            if not a and not dd:
                return None
            if r > 0 and c > 0 and not (a and dd):
                return None
    asign = asignar_definiciones(g, ts)
    if asign is None:
        return None
    usados = {(r, c) for (r, c, _) in asign.values()}
    for r in range(H):
        for c in range(W):
            if g[r][c] == "#" and (r, c) not in usados:
                return None
    # conexión de las casillas blancas
    blancas = [(r, c) for r in range(H) for c in range(W) if g[r][c] == "."]
    vistos, pila = {blancas[0]}, [blancas[0]]
    while pila:
        r, c = pila.pop()
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            v = (r + dr, c + dc)
            if 0 <= v[0] < H and 0 <= v[1] < W and g[v[0]][v[1]] == "." and v not in vistos:
                vistos.add(v)
                pila.append(v)
    if len(vistos) != len(blancas):
        return None
    return ts, asign


def tramo_libre(g, r, c, dr, dc):
    n = 0
    r, c = r + dr, c + dc
    while 0 <= r < H and 0 <= c < W and g[r][c] == ".":
        n += 1
        r, c = r + dr, c + dc
    return n


def puede_bloquear(g, r, c, pareja=True):
    """Devuelve las casillas que hay que convertir en definición para bloquear (r, c)
    sin dejar letras sueltas, o None si no se puede. En el borde derecho e inferior
    se permite una pareja de casillas de definición contiguas."""
    if r < 1 or c < 1 or g[r][c] != "." or (r == H - 1 and c == W - 1):
        return None
    celdas = [(r, c)]
    for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        if es_bloque(g, r + dr, c + dc):
            # solo se permite pegarse a las casillas de definición del borde
            if r + dr != 0 and c + dc != 0:
                return None
        elif tramo_libre(g, r, c, dr, dc) == 1:
            vr, vc = r + dr, c + dc
            en_borde = (dc == 1 and vc == W - 1) or (dr == 1 and vr == H - 1)
            if not (pareja and en_borde) or (vr == H - 1 and vc == W - 1):
                return None
            # la vecina del borde también pasa a ser definición
            for er, ec in ((dc, dr), (-dc, -dr)):
                if es_bloque(g, vr + er, vc + ec) or tramo_libre(g, vr, vc, er, ec) == 1:
                    return None
            celdas.append((vr, vc))
    return celdas


def generar_patron(rng):
    for _ in range(4000):
        g = patron_base()
        lim_a = rng.choice((6, 7, 7, 7))
        lim_d = rng.choice((6, 7, 7, 8))
        fallo = False
        for _paso in range(60):
            largos = [t for t in tramos(g) if t[3] > (lim_a if t[0] == "A" else lim_d)]
            if not largos:
                break
            d, r, c, n = rng.choice(largos)
            pos = [(r, c + k) if d == "A" else (r + k, c) for k in range(n)]
            pos = [b for b in (puede_bloquear(g, *p) for p in pos) if b]
            if not pos:
                fallo = True
                break
            for pr, pc in rng.choice(pos):
                g[pr][pc] = "#"
        else:
            fallo = True
        if fallo:
            continue
        res = patron_valido(g)
        if res:
            return g, res[0], res[1]
    raise RuntimeError("No se encontró un patrón válido")


# ---------------------------------------------------------------- relleno

class Relleno:
    def __init__(self, lex, rng, indice, ultimo_uso, usos):
        self.lex = lex
        self.rng = rng
        self.indice = indice
        self.ultimo_uso = ultimo_uso
        self.usos = usos
        self.por_len = defaultdict(list)
        for p in lex:
            sep = SEPARACION[len(p)]
            if p in ultimo_uso and indice - ultimo_uso[p] < sep:
                continue
            self.por_len[len(p)].append(p)
        for n in self.por_len:
            rng.shuffle(self.por_len[n])
            self.por_len[n].sort(key=lambda p: usos.get(p, 0))
        # índice por (longitud, posición, letra)
        self.idx = defaultdict(set)
        for n, lista in self.por_len.items():
            for p in lista:
                for i, ch in enumerate(p):
                    self.idx[(n, i, ch)].add(p)

    def opciones(self, patron, usadas):
        n = len(patron)
        conj = None
        for i, ch in enumerate(patron):
            if ch != ".":
                s = self.idx.get((n, i, ch), set())
                conj = s if conj is None else conj & s
                if not conj:
                    return []
        if conj is None:
            return [p for p in self.por_len[n] if p not in usadas]
        return [p for p in self.por_len[n] if p in conj and p not in usadas]

    def rellenar(self, g, ts, limite=1500):
        letras = {}
        celdas = []
        for d, r, c, n in ts:
            celdas.append([(r, c + k) if d == "A" else (r + k, c) for k in range(n)])
        cruces = defaultdict(list)
        for i, cs in enumerate(celdas):
            for pos in cs:
                cruces[pos].append(i)
        asign = {}
        usadas = set()
        self.nodos = 0

        def patron(i):
            return "".join(letras.get(pos, ".") for pos in celdas[i])

        def raices_chocan(p):
            for q in usadas:
                a, b = (p, q) if len(p) <= len(q) else (q, p)
                if len(a) >= 3 and b.startswith(a[: max(3, len(a) - 1)]) and len(b) - len(a) <= 2:
                    return True
            return False

        def resolver():
            self.nodos += 1
            if self.nodos > limite:
                return False
            mejor, mejor_ops = None, None
            for i in range(len(ts)):
                if i in asign:
                    continue
                ops = self.opciones(patron(i), usadas)
                if not ops:
                    return False
                if mejor is None or len(ops) < len(mejor_ops):
                    mejor, mejor_ops = i, ops
                    if len(ops) == 1:
                        break
            if mejor is None:
                return True
            for p in mejor_ops[:40]:
                if raices_chocan(p):
                    continue
                puestas = []
                for pos, ch in zip(celdas[mejor], p):
                    if pos not in letras:
                        letras[pos] = ch
                        puestas.append(pos)
                asign[mejor] = p
                usadas.add(p)
                ok = True
                for pos in puestas:
                    for j in cruces[pos]:
                        if j not in asign and not self.opciones(patron(j), usadas):
                            ok = False
                            break
                    if not ok:
                        break
                if ok and resolver():
                    return True
                del asign[mejor]
                usadas.discard(p)
                for pos in puestas:
                    del letras[pos]
            return False

        if resolver():
            return asign, letras
        return None


ORDEN_FLECHA = {"up-right": 0, "right": 1, "right-down": 2, "left-down": 3, "down-right": 4, "down": 5}


def elegir_textos(lex, palabras, usos):
    """Elige una definición por palabra evitando textos repetidos en el mismo pasatiempo."""
    vistos = set()
    res = {}
    for i, p in sorted(palabras.items()):
        pistas = lex[p]
        base = usos.get(p, 0)
        elegido = None
        for k in range(len(pistas)):
            t = pistas[(base + k) % len(pistas)]
            if t not in vistos:
                elegido = t
                break
        if elegido is None:
            return None
        vistos.add(elegido)
        res[i] = elegido
    return res


def palabra_de(filas, p):
    return "".join(filas[p["r"]][p["c"] + k] if p["dir"] == "A" else filas[p["r"] + k][p["c"]] for k in range(p["len"]))


def escribir_autodefinido(pz):
    """Un archivo por autodefinido, legible y fácil de editar a mano."""
    lineas = ["{", f'  "n": {pz["n"]},', '  "filas": [']
    lineas += [f'    "{f}"' + ("," if i < len(pz["filas"]) - 1 else "") for i, f in enumerate(pz["filas"])]
    lineas += ["  ],", '  "pistas": [']
    for i, p in enumerate(pz["pistas"]):
        d = {"palabra": palabra_de(pz["filas"], p), "texto": p["texto"], "dir": p["dir"], "r": p["r"], "c": p["c"],
             "cr": p["cr"], "cc": p["cc"], "flecha": p["flecha"]}
        lineas.append("    " + json.dumps(d, ensure_ascii=False) + ("," if i < len(pz["pistas"]) - 1 else ""))
    lineas += ["  ]", "}", ""]
    (CARPETA / f'{pz["n"]:04d}.json').write_text("\n".join(lineas), encoding="utf-8")


def leer_carpeta():
    """Lee autodefinidos/NNNN.json y devuelve la lista en el formato interno."""
    res = []
    for f in sorted(CARPETA.glob("[0-9]*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        filas = d["filas"]
        pistas = [{"cr": p["cr"], "cc": p["cc"], "flecha": p["flecha"], "texto": p["texto"], "r": p["r"], "c": p["c"],
                   "dir": p["dir"], "len": len(p["palabra"])} for p in d["pistas"]]
        res.append({"n": d["n"], "w": len(filas[0]), "h": len(filas), "filas": filas, "pistas": pistas, "_palabras": [p["palabra"] for p in d["pistas"]]})
    return res


def generar(cantidad, semilla, previos=()):
    lex = cargar_lexico()
    rng = random.Random(semilla)
    ultimo_uso, usos = {}, defaultdict(int)
    puzzles = []
    for pz in previos:
        for p in pz["pistas"]:
            w = palabra_de(pz["filas"], p)
            ultimo_uso[w] = len(puzzles)
            usos[w] += 1
        puzzles.append(pz)
    t0 = time.time()
    while len(puzzles) < cantidad:
        indice = len(puzzles)
        g, ts, asign_def = generar_patron(rng)
        rel = Relleno(lex, rng, indice, ultimo_uso, usos)
        res = rel.rellenar(g, ts)
        if not res:
            continue
        palabras, letras = res
        textos = elegir_textos(lex, palabras, usos)
        if textos is None:
            continue
        filas = ["".join(letras.get((r, c), "#") for c in range(W)) for r in range(H)]
        pistas = []
        for i, (d, r, c, n) in enumerate(ts):
            cr, cc, flecha = asign_def[i]
            pistas.append({"cr": cr, "cc": cc, "flecha": flecha, "texto": textos[i],
                           "r": r, "c": c, "dir": d, "len": n})
        pistas.sort(key=lambda p: (p["cr"], p["cc"], ORDEN_FLECHA[p["flecha"]]))
        for p in palabras.values():
            ultimo_uso[p] = indice
            usos[p] += 1
        puzzles.append({"n": indice + 1, "w": W, "h": H, "filas": filas, "pistas": pistas})
        if len(puzzles) % 10 == 0:
            print(f"  {len(puzzles)}/{cantidad}  ({time.time() - t0:.0f}s)", flush=True)
    return puzzles, lex, usos


def empaquetar(puzzles):
    """Escribe la copia que va dentro de la app (reserva sin conexión) y el índice."""
    limpio = [{k: v for k, v in pz.items() if not k.startswith("_")} for pz in puzzles]
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text(json.dumps(limpio, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (CARPETA / "indice.json").write_text(json.dumps({"total": len(limpio)}) + "\n", encoding="utf-8")


if __name__ == "__main__":
    # Uso: generar.py [cantidad] [semilla] [desde]
    #   desde = primer número que se vuelve a generar; los anteriores se conservan tal cual.
    cantidad = int(sys.argv[1]) if len(sys.argv) > 1 else 150
    semilla = int(sys.argv[2]) if len(sys.argv) > 2 else 2026
    desde = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    CARPETA.mkdir(exist_ok=True)
    previos = [p for p in leer_carpeta() if p["n"] < desde]
    puzzles, lex, usos = generar(cantidad, semilla, previos)
    for pz in puzzles[len(previos):]:
        escribir_autodefinido(pz)
    empaquetar(puzzles)
    print(f"{len(puzzles)} autodefinidos en {CARPETA} (nuevos: {len(puzzles) - len(previos)})")
    print(f"Léxico: {len(lex)} palabras; usadas alguna vez: {len(usos)}")
