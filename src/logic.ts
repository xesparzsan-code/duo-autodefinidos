import { POINTS } from './config';
import type { Puzzle } from './puzzles';

export interface CellEntry {
  l: string; // letra
  by: string; // uid de quien la puso
  t: number; // marca de tiempo
  h?: boolean; // puesta con una pista
}

export interface HintEntry {
  by: string;
  cost: number;
}

export type Cells = Record<string, CellEntry>;

export interface Derived {
  /** Casillas confirmadas: pertenecen a alguna palabra completa y correcta. */
  confirmed: Set<string>;
  /** Palabras completas y correctas. */
  doneWords: Set<number>;
  scores: Record<string, number>;
  letters: Record<string, number>;
  wordsBy: Record<string, number>;
  filled: number;
  complete: boolean;
}

/**
 * Calcula el estado del juego a partir de las letras escritas.
 * Es una función pura: los dos móviles llegan siempre al mismo marcador.
 *
 * - Una palabra se confirma cuando todas sus letras son correctas.
 * - Cada letra confirmada da puntos a quien la puso (salvo las de pista).
 * - Quien pone la última letra de una palabra se lleva un extra.
 */
export function derive(puzzle: Puzzle, cells: Cells, hints: Record<string, HintEntry> = {}): Derived {
  const confirmed = new Set<string>();
  const doneWords = new Set<number>();
  const scores: Record<string, number> = {};
  const letters: Record<string, number> = {};
  const wordsBy: Record<string, number> = {};
  const add = (o: Record<string, number>, uid: string, n: number) => {
    o[uid] = (o[uid] ?? 0) + n;
  };

  for (const w of puzzle.words) {
    let ok = true;
    let last: CellEntry | undefined;
    for (const k of w.cells) {
      const e = cells[k];
      if (!e || e.l !== puzzle.solution[k]) {
        ok = false;
        break;
      }
      if (!last || e.t > last.t) last = e;
    }
    if (!ok) continue;
    doneWords.add(w.id);
    for (const k of w.cells) confirmed.add(k);
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

  let filled = 0;
  let correct = 0;
  for (const k of Object.keys(puzzle.solution)) {
    const e = cells[k];
    if (e) {
      filled++;
      if (e.l === puzzle.solution[k]) correct++;
    }
  }

  return {
    confirmed,
    doneWords,
    scores,
    letters,
    wordsBy,
    filled,
    complete: correct === puzzle.whiteCount,
  };
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
