import { useColorScheme } from 'react-native';

export const PLAYER_COLORS = [
  { id: 'coral', name: 'Coral', hex: '#D9583B' },
  { id: 'teal', name: 'Turquesa', hex: '#1F8A8A' },
  { id: 'violet', name: 'Violeta', hex: '#7A5AC7' },
  { id: 'ocre', name: 'Ocre', hex: '#C28A17' },
  { id: 'blue', name: 'Azul', hex: '#2F6FCB' },
  { id: 'pink', name: 'Rosa', hex: '#CC4E86' },
] as const;

export function colorHex(id: string | undefined): string {
  return PLAYER_COLORS.find((c) => c.id === id)?.hex ?? PLAYER_COLORS[0].hex;
}

/** Mezcla un color con transparencia (hex + alfa 0..1) */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const light = {
  dark: false,
  bg: '#F7F2E8',
  card: '#FFFDF8',
  ink: '#22303C',
  inkSoft: '#5F6B76',
  inkFaint: '#9AA3AB',
  line: '#DDD3C0',
  gridLine: '#BFB39C',
  cell: '#FFFDF8',
  clueCell: '#EBE2D0',
  clueText: '#3B4650',
  active: '#FFE9A8',
  activeWord: '#FFF6D9',
  key: '#FFFDF8',
  keyText: '#22303C',
  accent: '#22303C',
  onAccent: '#FFFDF8',
  good: '#2E8B57',
};

const dark: typeof light = {
  dark: true,
  bg: '#151B21',
  card: '#1E262E',
  ink: '#F1EADB',
  inkSoft: '#B3BAC0',
  inkFaint: '#7C858D',
  line: '#313B45',
  gridLine: '#3C4752',
  cell: '#222B34',
  clueCell: '#2E3944',
  clueText: '#D8D2C4',
  active: '#6B5A1E',
  activeWord: '#3A3620',
  key: '#2A343E',
  keyText: '#F1EADB',
  accent: '#F1EADB',
  onAccent: '#151B21',
  good: '#5FC58C',
};

export type Theme = typeof light;

export function useTheme(pref: 'auto' | 'light' | 'dark' = 'auto'): Theme {
  const sys = useColorScheme();
  const mode = pref === 'auto' ? sys : pref;
  return mode === 'dark' ? dark : light;
}

export const fonts = {
  title: 'Fraunces_600SemiBold',
  titleBold: 'Fraunces_700Bold',
  body: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  bold: 'DMSans_700Bold',
};

export const radius = { sm: 10, md: 16, lg: 24 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
