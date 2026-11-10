# Dúo — autodefinido diario para dos

App para iPhone y Android (Expo / React Native). Cada día publica un autodefinido nuevo y
dos personas lo resuelven a la vez, cada una desde su móvil, viendo en directo lo que escribe la otra.

## Qué incluye

- **Autodefinidos de verdad**: definiciones dentro de las casillas, con flechas hacia la palabra.
- **150 autodefinidos originales** en castellano (uno por día, unos cinco meses). Una misma palabra
  larga no vuelve a salir hasta pasados 30-40 días.
- **Tiempo real para dos**: letras al instante, cursor de la otra persona en su color, y
  funcionamiento sin conexión (lo escrito se guarda y se envía al volver la cobertura).
- **Puntuación**: no se sabe si una palabra está bien hasta comprobarla o terminar. Al completar el
  autodefinido, 10 puntos por letra para quien la puso y +20 para quien remató cada palabra.
- **Extras**: racha diaria, pistas con coste (letra −15, comprobar palabra −10), archivo de días
  anteriores, temporizador, reacciones con emojis, «dar un toque» y estadísticas.
- **Avisos**: recordatorio diario local y avisos entre jugadores a través de la app gratuita ntfy.
- Modo claro y oscuro, elección de nombre y color.

## Puesta en marcha

### 1. Base de datos (Firebase, gratis)

1. Entra en <https://console.firebase.google.com> y crea un proyecto (sin Analytics).
2. Menú **Compilación → Realtime Database → Crear base de datos** (ubicación Europa, modo bloqueado).
3. En la pestaña **Reglas**, pega el contenido de `database.rules.json` y publica.
4. **Configuración del proyecto → Tus apps → Web (`</>`)**, registra la app y copia los valores
   de `firebaseConfig` en `src/config.ts`.

Hasta que rellenes `databaseURL`, la app funciona en modo «solo en este móvil».

### 2. Compilar con GitHub

1. Sube esta carpeta a un repositorio de GitHub.
2. Pestaña **Actions → Compilar apps → Run workflow**.
3. Al terminar (unos 20-30 minutos), descarga los artefactos:
   - `Duo-android` → `Duo.apk`
   - `Duo-iphone` → `Duo.ipa` (sin firmar)

Si creas una etiqueta `v1.0.0`, además se publican los dos archivos en **Releases**.

### 3. Instalar

- **Android**: abre `Duo.apk` en el móvil y permite instalar desde esa fuente.
- **iPhone**: pasa `Duo.ipa` al iPhone, ábrelo con **AltStore** (pestaña *My Apps → +*).
  AltStore lo firma con tu Apple ID. Recuerda que hay que refrescarla cada 7 días
  (AltServer lo hace solo si el ordenador está encendido y en la misma wifi).

### 4. Avisos entre los dos (ntfy)

En cada móvil: instala **ntfy** (App Store / Google Play) y, dentro de Dúo, entra en
**Ajustes → Avisos de tu pareja de juego → Suscribirme**. Pulsa **Probar** para comprobarlo.

> El iPhone instalado con AltStore y un Apple ID gratuito no admite notificaciones push propias;
> por eso los avisos entre jugadores viajan por ntfy. El recordatorio diario sí lo da Dúo.

### 5. Emparejar

Una persona pulsa **Invita a tu pareja de juego → Crear sala e invitar** y envía la invitación.
La otra introduce el código de 8 caracteres (o abre el enlace de la invitación).

## Desarrollo

```bash
npm install
npx expo start          # probar con Expo Go o en el navegador (tecla w)
npm run typecheck
```

## Más autodefinidos

Las palabras y definiciones están en `generador/lexico/*.txt` (formato `PALABRA: definición | otra`).
Para añadir palabras o regenerar el banco hace falta Python 3:

```bash
npm run generar -- 150 2026   # cantidad y semilla
npm run validar
```

El primer autodefinido corresponde al día `START_DATE` de `src/config.ts`. Al acabarse el banco
vuelve a empezar por el n.º 1.

## Estructura

| Ruta | Contenido |
| --- | --- |
| `App.tsx` | Arranque, navegación y suscripciones de la sala |
| `src/screens/` | Pantallas: inicio, juego, emparejar, archivo, marcador, ajustes |
| `src/Grid.tsx` | Rejilla del autodefinido (casillas, definiciones y flechas) |
| `src/logic.ts` | Puntuación, racha y estadísticas |
| `src/sync.ts` | Tiempo real con Firebase y respaldo sin conexión |
| `src/notify.ts` | Avisos (ntfy y recordatorio diario) |
| `generador/` | Generador y validador de autodefinidos, y el léxico |
| `.github/workflows/compilar.yml` | Compilación de `.apk` y `.ipa` |
