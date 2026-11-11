#!/usr/bin/env python3
"""Copia los autodefinidos de autodefinidos/ dentro de la app (reserva sin conexión)
y actualiza indice.json. La compilación de GitHub lo ejecuta sola."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generar as G

puzzles = G.leer_carpeta()
G.empaquetar(puzzles)
print(f"{len(puzzles)} autodefinidos empaquetados")
