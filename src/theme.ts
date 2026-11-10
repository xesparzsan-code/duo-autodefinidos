import { useColorScheme } from 'react-native';

export const PLAYER_COLORS = [
  { id: 'coral', name: 'Rojo', hex: '#E0412F' },
  { id: 'blue', name: 'Azul', hex: '#2456D6' },
  { id: 'teal', name: 'Verde', hex: '#0E8F6E' },
  { id: 'violet', name: 'Violeta', hex: '#7B4FD0' },
  { id: 'ocre', name: 'Naranja', hex: '#D97706' },
  { id: 'pink', name: 'Rosa', hex: '#D6367F' },
] as const;

export function colorHex(id: string | undefined): string {
  return PLAYER_COLORS.find((c) => c.id === id)?.hex ?? PLAYER_COLORS[0].hex;
}

/** Mezcla un color con transparencia (hex + alfa 0..1) */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Aspecto de «revista de pasatiempos»: papel claro, tinta azul marino de imprenta,
// colores planos de cartel y letras escritas a mano con el boli de cada jugador.
const light = {
  dark: false,
  bg: '#F3F4EE',
  card: '#FFFFFF',
  ink: '#1C2140',
  inkSoft: '#555B7A',
  inkFaint: '#8E93AD',
  line: '#D6D9E2',
  gridLine: '#9BA0BC',
  cell: '#FFFFFF',
  clueCell: '#FFEDAA',
  clueText: '#1C2140',
  active: '#A9E5CD',
  activeWord: '#DDF4EA',
  key: '#FFFFFF',
  keyText: '#1C2140',
  accent: '#2D46B9',
  onAccent: '#FFFFFF',
  good: '#19A47E',
  // colores de cartel
  yellow: '#FFC53D',
  tomato: '#F0483E',
  mint: '#19A47E',
  cobalt: '#2D46B9',
};

const dark: typeof light = {
  dark: true,
  bg: '#14172B',
  card: '#1E2240',
  ink: '#EEF0F8',
  inkSoft: '#B4B9D3',
  inkFaint: '#7F84A3',
  line: '#30355A',
  gridLine: '#454B78',
  cell: '#1E2240',
  clueCell: '#4D4420',
  clueText: '#FFEDAA',
  active: '#1E6B55',
  activeWord: '#1F3F3D',
  key: '#262B4F',
  keyText: '#EEF0F8',
  accent: '#5C74EA',
  onAccent: '#FFFFFF',
  good: '#3CCB9F',
  yellow: '#FFC53D',
  tomato: '#F0483E',
  mint: '#19A47E',
  cobalt: '#3F58CC',
};

export type Theme = typeof light;

export function useTheme(pref: 'auto' | 'light' | 'dark' = 'auto'): Theme {
  const sys = useColorScheme();
  const mode = pref === 'auto' ? sys : pref;
  return mode === 'dark' ? dark : light;
}

export const fonts = {
  title: 'Syne_700Bold',
  titleBold: 'Syne_800ExtraBold',
  body: 'BarlowSemiCondensed_400Regular',
  medium: 'BarlowSemiCondensed_500Medium',
  bold: 'BarlowSemiCondensed_600SemiBold',
  /** Letra manuscrita: lo que escriben los jugadores. */
  hand: 'PatrickHand_400Regular',
};

export const radius = { sm: 4, md: 6, lg: 8 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
