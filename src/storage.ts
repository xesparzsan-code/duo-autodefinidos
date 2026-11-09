import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Profile {
  uid: string;
  name: string;
  color: string;
  /** Código de la sala compartida (null = jugando solo). */
  room: string | null;
  /** Tema privado de ntfy donde este móvil recibe los avisos. */
  topic: string;
  /** Hora del aviso diario (0-23) o null si está desactivado. */
  reminderHour: number | null;
  theme: 'auto' | 'light' | 'dark';
  haptics: boolean;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomId(len: number, alphabet = ALPHABET): string {
  let s = '';
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export function newProfile(name: string, color: string): Profile {
  return {
    uid: randomId(12, 'abcdefghijklmnopqrstuvwxyz0123456789'),
    name,
    color,
    room: null,
    topic: `duo-${randomId(14, 'abcdefghijklmnopqrstuvwxyz0123456789')}`,
    reminderHour: 9,
    theme: 'auto',
    haptics: true,
  };
}

export async function loadJSON<T>(k: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function saveJSON(k: string, v: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(k, JSON.stringify(v));
  } catch {
    // sin espacio o almacenamiento no disponible: el juego sigue en memoria
  }
}

export const loadProfile = () => loadJSON<Profile>('profile');
export const saveProfile = (p: Profile) => saveJSON('profile', p);
