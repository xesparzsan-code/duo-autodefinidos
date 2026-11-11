# Autodefinidos de Dúo

Aquí está cada autodefinido en su propio archivo: `0001.json` es el del primer día, `0002.json`
el del segundo, etc. La app los descarga de esta carpeta, así que **lo que edites aquí llega a
los móviles sin recompilar** (tarda unos minutos y hace falta que el repositorio sea público).

## Cambiar una definición

Abre el archivo en GitHub, pulsa el lápiz y cambia solo el texto de `"texto"`:

```json
{"palabra": "GORILA", "texto": "Simio enorme", "dir": "D", "r": 0, "c": 1, ...}
```

- Máximo 40 caracteres; cuanto más corta, mejor se lee en la casilla.
- No toques `palabra`, `dir`, `r`, `c`, `cr`, `cc` ni `flecha` si solo quieres cambiar la definición.

## Cambiar una palabra

Hay que cambiarla en dos sitios y que coincidan:

1. En `"filas"`, que es el dibujo de la rejilla (`#` = casilla de definición, letras en mayúscula y
   sin tildes; la Ñ sí vale).
2. En `"palabra"` de su pista… y en las pistas de las palabras que la cruzan, porque comparten letras.

## Qué significa cada campo

| Campo | Significado |
| --- | --- |
| `palabra` | La solución (debe coincidir con las letras de `filas`) |
| `texto` | La definición que se ve en la casilla |
| `dir` | `A` = horizontal, `D` = vertical |
| `r`, `c` | Fila y columna (empezando en 0) de la primera letra |
| `cr`, `cc` | Fila y columna de la casilla donde va la definición |
| `flecha` | Hacia dónde apunta: `right`, `down`, `right-down`, `down-right`, `left-down`, `up-right` |

## Revisión automática

Cada vez que guardas un cambio, GitHub revisa todos los archivos (pestaña **Actions → Revisar
autodefinidos**). Si sale en rojo, abre la revisión: dice qué archivo y qué está mal. Además, la
app ignora un archivo que no tenga la forma correcta y usa el que lleva dentro.

## Avisos

- **No edites el autodefinido de hoy si ya habéis empezado a jugarlo**: la partida empezada sigue
  con la versión con la que se empezó.
- Para añadir días nuevos, crea el archivo siguiente (`0151.json`…) y sube el `total` de
  `indice.json`. Cuando se acaban, la app vuelve a empezar por el `0001`.
- `generador/generar.py` crea autodefinidos nuevos automáticamente a partir de las palabras de
  `generador/lexico/`.
