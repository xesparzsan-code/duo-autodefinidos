import { useEffect, useState } from 'react';
import bank from './data/puzzles.json';
import { PUZZLES_URL, START_DATE } from './config';
import { loadJSON, saveJSON } from './storage';

export type ArrowKind = 'right' | 'down' | 'right-down' | 'down-right' | 'left-down' | 'up-right';

export interface RawClue {
  cr: number;
  cc: number;
  flecha: ArrowKind;
  texto: string;
  r: number;
  c: number;
  dir: 'A' | 'D';
  len?: number;
  palabra?: string;
}

export interface RawPuzzle {
  n: number;
  w?: number;
  h?: number;
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

// ------------------------------------------------------------ banco: GitHub + reserva interna

interface RemoteStore {
  total: number | null;
  items: Record<string, RawPuzzle>;
}

let remote: RemoteStore = { total: null, items: {} };
let version = 0;
const listeners = new Set<() => void>();
const built: Record<string, Puzzle> = {};

function changed() {
  version++;
  for (const k of Object.keys(built)) delete built[k];
  listeners.forEach((l) => l());
}

/** Comprueba que un autodefinido descargado tiene la forma correcta antes de usarlo. */
export function validRaw(x: unknown): x is RawPuzzle {
  const r = x as RawPuzzle;
  if (!r || !Array.isArray(r.filas) || !Array.isArray(r.pistas) || r.filas.length < 3 || r.pistas.length < 4) return false;
  const w = r.filas[0]?.length ?? 0;
  if (w < 3 || r.filas.some((f) => typeof f !== 'string' || f.length !== w)) return false;
  return r.pistas.every((p) => {
    const len = p.len ?? p.palabra?.length ?? 0;
    const endR = p.dir === 'D' ? p.r + len - 1 : p.r;
    const endC = p.dir === 'A' ? p.c + len - 1 : p.c;
    return (
      typeof p.texto === 'string' && p.texto.length > 0 && (p.dir === 'A' || p.dir === 'D') && len >= 2 &&
      p.r >= 0 && p.c >= 0 && endR < r.filas.length && endC < w &&
      r.filas[p.cr]?.[p.cc] === '#' && r.filas[p.r][p.c] !== '#' && r.filas[endR][endC] !== '#'
    );
  });
}

/** Carga lo descargado en sesiones anteriores (para jugar sin conexión con lo último). */
export async function loadRemoteCache(): Promise<void> {
  const saved = await loadJSON<RemoteStore>('banco-remoto');
  if (saved && saved.items) {
    remote = { total: saved.total ?? null, items: saved.items };
    changed();
  }
}

function slot(date: string): number {
  const total = remote.total ?? BANK.length;
  return ((puzzleNumber(date) - 1) % Math.max(1, total)) + 1;
}

/** Autodefinido (en bruto) que corresponde a una fecha: el de GitHub si lo hay, si no el interno. */
export function rawForDate(date: string): RawPuzzle {
  const n = slot(date);
  return remote.items[n] ?? BANK[(n - 1) % BANK.length];
}

const fetched: Record<string, number> = {};

/** Descarga de GitHub el autodefinido de una fecha y el índice. No falla nunca: sin red, no hace nada. */
export async function refreshPuzzle(date: string): Promise<void> {
  const last = fetched[date] ?? 0;
  if (Date.now() - last < 5 * 60 * 1000) return;
  fetched[date] = Date.now();
  const bust = `?t=${Math.floor(Date.now() / 300000)}`;
  let dirty = false;
  try {
    const ri = await fetch(`${PUZZLES_URL}/indice.json${bust}`);
    if (ri.ok) {
      const idx = (await ri.json()) as { total?: number };
      if (typeof idx.total === 'number' && idx.total > 0 && idx.total !== remote.total) {
        remote.total = idx.total;
        dirty = true;
      }
    }
    const n = slot(date);
    const rp = await fetch(`${PUZZLES_URL}/${`${n}`.padStart(4, '0')}.json${bust}`);
    if (rp.ok) {
      const raw = (await rp.json()) as unknown;
      if (validRaw(raw) && JSON.stringify(raw) !== JSON.stringify(remote.items[n])) {
        remote.items[n] = raw;
        dirty = true;
      }
    }
  } catch {
    // sin conexión o repositorio privado: se sigue con lo que hay
  }
  if (dirty) {
    // se guardan solo los más recientes para no llenar el móvil
    const keys = Object.keys(remote.items);
    if (keys.length > 60) keys.slice(0, keys.length - 60).forEach((k) => delete remote.items[k]);
    saveJSON('banco-remoto', remote);
    changed();
  }
}

// ------------------------------------------------------------ construcción

export function buildPuzzle(raw: RawPuzzle, date: string): Puzzle {
  const h = raw.filas.length;
  const w = raw.filas[0].length;
  const solution: Record<string, string> = {};
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const ch = raw.filas[r][c];
      if (ch !== '#') solution[key(r, c)] = ch;
    }
  }
  const words: Word[] = raw.pistas.map((p, id) => {
    const len = p.len ?? p.palabra?.length ?? 0;
    return {
      id,
      clue: p.texto,
      dir: p.dir,
      arrow: p.flecha,
      clueCell: key(p.cr, p.cc),
      cells: Array.from({ length: len }, (_, k) => (p.dir === 'A' ? key(p.r, p.c + k) : key(p.r + k, p.c))),
    };
  });
  const wordsAt: Record<string, number[]> = {};
  const cluesAt: Record<string, number[]> = {};
  const arrowsAt: Record<string, ArrowKind[]> = {};
  for (const wd of words) {
    for (const k of wd.cells) (wordsAt[k] ||= []).push(wd.id);
    (cluesAt[wd.clueCell] ||= []).push(wd.id);
    (arrowsAt[wd.cells[0]] ||= []).push(wd.arrow);
  }
  return { n: puzzleNumber(date), date, w, h, solution, words, wordsAt, cluesAt, arrowsAt, whiteCount: Object.keys(solution).length };
}

export function puzzleForDate(date: string): Puzzle {
  if (!built[date]) built[date] = buildPuzzle(rawForDate(date), date);
  return built[date];
}

/** Autodefinido de una fecha; se actualiza solo si llega una versión nueva de GitHub. */
export function usePuzzle(date: string): Puzzle {
  const [, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    refreshPuzzle(date);
    return () => {
      listeners.delete(l);
    };
  }, [date]);
  return puzzleForDate(date);
}

const shared: Record<string, Puzzle> = {};

/**
 * Autodefinido de una partida: si la sala ya fijó uno (JSON), se usa ese;
 * si no, el que corresponde a la fecha.
 */
export function gamePuzzle(date: string, json: string | null | undefined): Puzzle {
  if (json) {
    const k = `${date}|${json.length}|${json.slice(0, 80)}`;
    if (shared[k]) return shared[k];
    try {
      const raw = JSON.parse(json) as unknown;
      if (validRaw(raw)) return (shared[k] = buildPuzzle(raw, date));
    } catch {
      // JSON dañado: se usa el de la fecha
    }
  }
  return puzzleForDate(date);
}
