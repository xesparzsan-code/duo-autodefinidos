/**
 * CONFIGURACIÓN — lo único que hay que tocar para poner la app en marcha.
 *
 * 1. Crea un proyecto gratuito en https://console.firebase.google.com
 * 2. Añade una "Realtime Database" (en modo bloqueado) y pega las reglas de database.rules.json
 * 3. En Configuración del proyecto → "Tus apps" → Web (</>) copia los valores aquí.
 *
 * Mientras databaseURL esté vacío la app funciona en modo "solo en este móvil".
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyDd9n33hjuO_nSMxAdqEtgl11E2j_wbIVU',
  authDomain: 'duo-autodefinidos.firebaseapp.com',
  // PENDIENTE: dirección de la Realtime Database (aparece arriba en su página de la consola)
  databaseURL: '',
  projectId: 'duo-autodefinidos',
  storageBucket: 'duo-autodefinidos.firebasestorage.app',
  messagingSenderId: '315625334760',
  appId: '1:315625334760:web:53cc0b0f56417d352aa65d',
};

/** Día en que se publica el autodefinido n.º 1 (AAAA-MM-DD). */
export const START_DATE = '2026-11-09';

/** Servidor de ntfy para los avisos entre los dos móviles. */
export const NTFY_SERVER = 'https://ntfy.sh';

/** Esquema de enlace de la app (invitaciones). */
export const APP_SCHEME = 'duoautodef';

export const POINTS = {
  letter: 10,
  wordBonus: 20,
  hintLetter: -15,
  checkWord: -10,
};

export const firebaseEnabled = firebaseConfig.databaseURL.length > 0;
