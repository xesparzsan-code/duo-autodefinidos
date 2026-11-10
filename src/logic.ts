import { POINTS } from './config';
import type { Puzzle } from './puzzles';

export interface CellEntry {
  l: string; // letra
  by: string; // uid de quien la puso
  t: number; // marca de tiempo
  h?: boolean; // puesta con una pista
  ok?: boolean; // comprobada: se sabe que es correcta y queda fija
}

export interface HintEntry {
  by: string;
  cost: number;
}

export type Cells = Record<string, CellEntry>;

export interface Derived {
  /** Casillas fijas: comprobadas con una pista o, al terminar, todas. */
  confirmed: Set<string>;
  /** Palabras con todas sus casillas fijas. */
  doneWords: Set<number>;
  /** Palabras con todas las casillas escritas (acertadas o no). */
  filledWords: Set<number>;
  scores: Record<string, number>;
  letters: Record<string, number>;
  wordsBy: Record<string, number>;
  /** Letras escritas ahora mismo por cada jugador (sin saber si son correctas). */
  placed: Record<string, number>;
  filled: number;
  complete: boolean;
}

/**
 * Calcula el estado del juego a partir de las letras escritas.
 * Es una función pura: los dos móviles llegan siempre al mismo marcador.
 *
 * - Mientras se juega NO se indica si una palabra está bien: solo quedan fijas las
 *   letras comprobadas con «Comprobar» o reveladas con una pista.
 * - Cuando todo el autodefinido es correcto, se reparten los puntos: cada letra
 *   puntúa para quien la puso (salvo las de pista) y quien puso la última letra
 *   de cada palabra se lleva un extra.
 */
export function derive(puzzle: Puzzle, cells: Cells, hints: Record<string, HintEntry> = {}): Derived {
  const confirmed = new Set<string>();
  const doneWords = new Set<number>();
  const filledWords = new Set<number>();
  const scores: Record<string, number> = {};
  const letters: Record<string, number> = {};
  const wordsBy: Record<string, number> = {};
  const placed: Record<string, number> = {};
  const add = (o: Record<string, number>, uid: string, n: number) => {
    o[uid] = (o[uid] ?? 0) + n;
  };

  let filled = 0;
  let correct = 0;
  for (const k of Object.keys(puzzle.solution)) {
    const e = cells[k];
    if (!e) continue;
    filled++;
    add(placed, e.by, 1);
    if (e.l === puzzle.solution[k]) correct++;
  }
  const complete = correct === puzzle.whiteCount;

  for (const k of Object.keys(puzzle.solution)) {
    const e = cells[k];
    if (e && e.l === puzzle.solution[k] && (complete || e.ok)) confirmed.add(k);
  }

  for (const w of puzzle.words) {
    if (w.cells.every((k) => cells[k])) filledWords.add(w.id);
    if (!w.cells.every((k) => confirmed.has(k))) continue;
    doneWords.add(w.id);
    let last: CellEntry | undefined;
    for (const k of w.cells) {
      const e = cells[k];
      if (!last || e.t > last.t) last = e;
    }
    if (last && !last.h) {
      add(scores, last.by, POINTS.wordBonus);
      add(wordsBy, last.by, 1);
    }
  }

  for (const k of confirmed) {
    const e = cells[k];
    if (!e.h) {
      add(scores, e.by, POINTS.letter);
      add(letters, e.by, 1);
    }
  }

  for (const h of Object.values(hints)) add(scores, h.by, h.cost);

  return { confirmed, doneWords, filledWords, scores, letters, wordsBy, placed, filled, complete };
}

export function formatTime(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return h > 0 ? `${h}:${pad(m % 60)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

export interface DayResult {
  scores: Record<string, number>;
  secs: number;
  finishedAt: number;
  n: number;
}

export interface Stats {
  played: number;
  wins: Record<string, number>;
  ties: number;
  points: Record<string, number>;
  bestSecs: number | null;
  streak: number;
  bestStreak: number;
}

/** Estadísticas y racha a partir de los resultados guardados por día. */
export function computeStats(results: Record<string, DayResult>, todayStr: string, prevDay: (d: string) => string): Stats {
  const st: Stats = { played: 0, wins: {}, ties: 0, points: {}, bestSecs: null, streak: 0, bestStreak: 0 };
  const dates = Object.keys(results).sort();
  for (const d of dates) {
    const r = results[d];
    st.played++;
    const entries = Object.entries(r.scores ?? {});
    for (const [uid, p] of entries) st.points[uid] = (st.points[uid] ?? 0) + p;
    if (entries.length) {
      const max = Math.max(...entries.map(([, p]) => p));
      const top = entries.filter(([, p]) => p === max);
      if (top.length === 1 && entries.length > 1) st.wins[top[0][0]] = (st.wins[top[0][0]] ?? 0) + 1;
      else if (entries.length > 1) st.ties++;
    }
    if (r.secs > 0 && (st.bestSecs === null || r.secs < st.bestSecs)) st.bestSecs = r.secs;
  }
  // racha actual: días seguidos hasta hoy (o hasta ayer si hoy aún no se ha completado)
  let d = results[todayStr] ? todayStr : prevDay(todayStr);
  while (results[d]) {
    st.streak++;
    d = prevDay(d);
  }
  // mejor racha
  let run = 0;
  let prev: string | null = null;
  for (const cur of dates) {
    run = prev && prevDay(cur) === prev ? run + 1 : 1;
    if (run > st.bestStreak) st.bestStreak = run;
    prev = cur;
  }
  return st;
}
