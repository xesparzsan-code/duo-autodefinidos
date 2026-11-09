import bank from './data/puzzles.json';
import { START_DATE } from './config';

export type ArrowKind = 'right' | 'down' | 'right-down' | 'down-right' | 'left-down' | 'up-right';

export interface RawClue {
  cr: number;
  cc: number;
  flecha: ArrowKind;
  texto: string;
  r: number;
  c: number;
  dir: 'A' | 'D';
  len: number;
}

export interface RawPuzzle {
  n: number;
  w: number;
  h: number;
  filas: string[];
  pistas: RawClue[];
}

export interface Word {
  id: number;
  clue: string;
  dir: 'A' | 'D';
  cells: string[]; // claves "r_c"
  arrow: ArrowKind;
  clueCell: string;
}

export interface Puzzle {
  n: number;
  date: string;
  w: number;
  h: number;
  solution: Record<string, string>; // "r_c" -> letra (solo casillas blancas)
  words: Word[];
  wordsAt: Record<string, number[]>; // "r_c" -> ids de palabras que pasan por la casilla
  cluesAt: Record<string, number[]>; // casilla de definición -> ids de palabras
  arrowsAt: Record<string, ArrowKind[]>; // primera casilla -> flechas
  whiteCount: number;
}

const BANK = bank as RawPuzzle[];
export const BANK_SIZE = BANK.length;

export const key = (r: number, c: number) => `${r}_${c}`;
export const parseKey = (k: string): [number, number] => {
  const [r, c] = k.split('_').map(Number);
  return [r, c];
};

// ------------------------------------------------------------ fechas

export function toDateStr(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function today(): string {
  return toDateStr(new Date());
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function prettyDate(s: string, withWeekday = true): string {
  const d = parseDate(s);
  const base = `${d.getDate()} de ${MESES[d.getMonth()]}`;
  if (!withWeekday) return base;
  const dia = DIAS[d.getDay()];
  return `${dia[0].toUpperCase()}${dia.slice(1)}, ${base}`;
}

/** Número de autodefinido (1, 2, 3…) que toca en una fecha. */
export function puzzleNumber(date: string): number {
  return Math.max(0, daysBetween(START_DATE, date)) + 1;
}

/** Fechas jugables: desde el día de inicio hasta hoy (la más reciente primero). */
export function availableDates(limit = 60): string[] {
  const t = today();
  const total = Math.max(0, daysBetween(START_DATE, t));
  const res: string[] = [];
  for (let i = 0; i <= Math.min(total, limit - 1); i++) res.push(addDays(t, -i));
  return res;
}

// ------------------------------------------------------------ construcción

const cache: Record<string, Puzzle> = {};

export function puzzleForDate(date: string): Puzzle {
  if (cache[date]) return cache[date];
  const num = puzzleNumber(date);
  const raw = BANK[(num - 1) % BANK.length];
  const solution: Record<string, string> = {};
  for (let r = 0; r < raw.h; r++) {
    for (let c = 0; c < raw.w; c++) {
      const ch = raw.filas[r][c];
      if (ch !== '#') solution[key(r, c)] = ch;
    }
  }
  const words: Word[] = raw.pistas.map((p, id) => ({
    id,
    clue: p.texto,
    dir: p.dir,
    arrow: p.flecha,
    clueCell: key(p.cr, p.cc),
    cells: Array.from({ length: p.len }, (_, k) => (p.dir === 'A' ? key(p.r, p.c + k) : key(p.r + k, p.c))),
  }));
  const wordsAt: Record<string, number[]> = {};
  const cluesAt: Record<string, number[]> = {};
  const arrowsAt: Record<string, ArrowKind[]> = {};
  for (const w of words) {
    for (const k of w.cells) (wordsAt[k] ||= []).push(w.id);
    (cluesAt[w.clueCell] ||= []).push(w.id);
    (arrowsAt[w.cells[0]] ||= []).push(w.arrow);
  }
  const p: Puzzle = {
    n: num,
    date,
    w: raw.w,
    h: raw.h,
    solution,
    words,
    wordsAt,
    cluesAt,
    arrowsAt,
    whiteCount: Object.keys(solution).length,
  };
  cache[date] = p;
  return p;
}
