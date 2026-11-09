/**
 * Sincronización en tiempo real (Firebase Realtime Database) con respaldo local.
 *
 * Cada cambio se aplica primero en el móvil y se guarda en disco; después se envía.
 * Si no hay conexión, los cambios quedan pendientes y se reenvían al volver,
 * incluso si la app se cerró entre medias.
 */
import { initializeApp, getApps } from 'firebase/app';
import {
  getDatabase,
  ref,
  onValue,
  set,
  remove,
  push,
  get,
  update,
  onDisconnect,
  runTransaction,
  type Database,
} from 'firebase/database';
import { firebaseConfig, firebaseEnabled } from './config';
import type { Cells, CellEntry, HintEntry, DayResult } from './logic';
import { loadJSON, saveJSON, randomId, type Profile } from './storage';

let db: Database | null = null;
let serverOffset = 0;
let connected = false;
const connListeners = new Set<(c: boolean) => void>();

function database(): Database | null {
  if (!firebaseEnabled) return null;
  if (!db) {
    const app = getApps()[0] ?? initializeApp(firebaseConfig);
    db = getDatabase(app);
    onValue(ref(db, '.info/serverTimeOffset'), (s) => {
      serverOffset = (s.val() as number) ?? 0;
    });
    onValue(ref(db, '.info/connected'), (s) => {
      connected = !!s.val();
      connListeners.forEach((l) => l(connected));
    });
  }
  return db;
}

export const now = () => Date.now() + serverOffset;

export function onConnection(cb: (c: boolean) => void): () => void {
  database();
  connListeners.add(cb);
  cb(connected);
  return () => {
    connListeners.delete(cb);
  };
}

// ------------------------------------------------------------ salas y jugadores

export interface Player {
  uid: string;
  name: string;
  color: string;
  topic: string;
}

const publicPlayer = (p: Profile): Player => ({ uid: p.uid, name: p.name, color: p.color, topic: p.topic });

export async function createRoom(profile: Profile): Promise<string> {
  const d = database();
  if (!d) throw new Error('sin-firebase');
  const code = randomId(8);
  await set(ref(d, `rooms/${code}/players/${profile.uid}`), publicPlayer(profile));
  return code;
}

export type JoinResult = 'ok' | 'full' | 'notfound' | 'error';

export async function joinRoom(codeRaw: string, profile: Profile): Promise<JoinResult> {
  const d = database();
  if (!d) return 'error';
  const code = codeRaw.trim().toUpperCase();
  if (!/^[A-Z0-9]{6,12}$/.test(code)) return 'notfound';
  try {
    const snap = await get(ref(d, `rooms/${code}/players`));
    const players = (snap.val() ?? {}) as Record<string, Player>;
    const uids = Object.keys(players);
    if (uids.length === 0) return 'notfound';
    if (uids.length >= 2 && !uids.includes(profile.uid)) return 'full';
    await set(ref(d, `rooms/${code}/players/${profile.uid}`), publicPlayer(profile));
    return 'ok';
  } catch {
    return 'error';
  }
}

export function updatePlayer(profile: Profile): void {
  const d = database();
  if (d && profile.room) set(ref(d, `rooms/${profile.room}/players/${profile.uid}`), publicPlayer(profile)).catch(() => {});
}

export async function leaveRoom(profile: Profile): Promise<void> {
  const d = database();
  if (d && profile.room) await remove(ref(d, `rooms/${profile.room}/players/${profile.uid}`)).catch(() => {});
}

export function subscribePlayers(room: string, cb: (players: Record<string, Player>) => void): () => void {
  const d = database();
  if (!d) return () => {};
  return onValue(ref(d, `rooms/${room}/players`), (s) => cb((s.val() ?? {}) as Record<string, Player>));
}

// ------------------------------------------------------------ presencia

export interface Presence {
  t: number;
  date?: string | null;
  k?: string | null;
  dir?: 'A' | 'D' | null;
}

export function setPresence(room: string | null, uid: string, p: Omit<Presence, 't'>): void {
  const d = database();
  if (!d || !room) return;
  const r = ref(d, `rooms/${room}/presence/${uid}`);
  onDisconnect(r).remove().catch(() => {});
  set(r, { ...p, t: now() }).catch(() => {});
}

export function clearPresence(room: string | null, uid: string): void {
  const d = database();
  if (d && room) remove(ref(d, `rooms/${room}/presence/${uid}`)).catch(() => {});
}

export function subscribePresence(room: string, cb: (p: Record<string, Presence>) => void): () => void {
  const d = database();
  if (!d) return () => {};
  return onValue(ref(d, `rooms/${room}/presence`), (s) => cb((s.val() ?? {}) as Record<string, Presence>));
}

// ------------------------------------------------------------ reacciones y toques

export interface Signal {
  by: string;
  t: number;
  emoji?: string;
  kind: 'emoji' | 'poke';
}

export function sendSignal(room: string | null, sig: Omit<Signal, 't'>): void {
  const d = database();
  if (!d || !room) return;
  set(push(ref(d, `rooms/${room}/signals`)), { ...sig, t: now() }).catch(() => {});
}

/** Avisa solo de las señales nuevas (posteriores al momento de suscribirse). */
export function subscribeSignals(room: string, uid: string, cb: (s: Signal) => void): () => void {
  const d = database();
  if (!d) return () => {};
  const since = now() - 4000;
  const seen = new Set<string>();
  return onValue(ref(d, `rooms/${room}/signals`), (snap) => {
    const all = (snap.val() ?? {}) as Record<string, Signal>;
    const ids = Object.keys(all);
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const s = all[id];
      if (s.t >= since && s.by !== uid) cb(s);
    }
    // limpieza: no dejar crecer la lista
    if (ids.length > 30) {
      const old = ids.sort((a, b) => all[a].t - all[b].t).slice(0, ids.length - 10);
      const patch: Record<string, null> = {};
      old.forEach((id) => (patch[id] = null));
      update(ref(d, `rooms/${room}/signals`), patch).catch(() => {});
    }
  });
}

// ------------------------------------------------------------ resultados

const resultListeners = new Map<string, Set<(r: Record<string, DayResult>) => void>>();

export function subscribeResults(room: string | null, cb: (r: Record<string, DayResult>) => void): () => void {
  const d = database();
  let alive = true;
  const localKey = `results:${room ?? 'solo'}`;
  if (!resultListeners.has(localKey)) resultListeners.set(localKey, new Set());
  resultListeners.get(localKey)!.add(cb);
  loadJSON<Record<string, DayResult>>(localKey).then((r) => {
    if (alive) cb(r ?? {});
  });
  if (!d || !room) {
    return () => {
      alive = false;
      resultListeners.get(localKey)?.delete(cb);
    };
  }
  const off = onValue(ref(d, `rooms/${room}/results`), (s) => {
    const r = (s.val() ?? {}) as Record<string, DayResult>;
    saveJSON(localKey, r);
    cb(r);
  });
  return () => {
    alive = false;
    resultListeners.get(localKey)?.delete(cb);
    off();
  };
}

async function saveResult(room: string | null, date: string, result: DayResult): Promise<void> {
  const localKey = `results:${room ?? 'solo'}`;
  const all = (await loadJSON<Record<string, DayResult>>(localKey)) ?? {};
  if (!all[date]) {
    all[date] = result;
    await saveJSON(localKey, all);
    resultListeners.get(localKey)?.forEach((l) => l({ ...all }));
  }
  const d = database();
  if (d && room) {
    // solo se guarda el primer resultado: los dos móviles calculan lo mismo
    runTransaction(ref(d, `rooms/${room}/results/${date}`), (cur) => cur ?? result).catch(() => {});
  }
}

// ------------------------------------------------------------ partida

export interface GameState {
  cells: Cells;
  hints: Record<string, HintEntry>;
  startedAt: number | null;
  finishedAt: number | null;
  loaded: boolean;
}

type PendingOp = { cell: CellEntry | null };

interface Cache {
  cells: Cells;
  hints: Record<string, HintEntry>;
  startedAt: number | null;
  finishedAt: number | null;
  pending: Record<string, PendingOp>;
  pendingHints: Record<string, HintEntry>;
}

export class GameSession {
  private state: GameState = { cells: {}, hints: {}, startedAt: null, finishedAt: null, loaded: false };
  private remote: { cells: Cells; hints: Record<string, HintEntry>; startedAt: number | null; finishedAt: number | null } | null = null;
  private pending: Record<string, PendingOp> = {};
  private pendingHints: Record<string, HintEntry> = {};
  private listeners = new Set<(s: GameState) => void>();
  private off: (() => void) | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private readonly cacheKey: string;
  private readonly path: string | null;

  constructor(
    private readonly room: string | null,
    readonly date: string,
    private readonly uid: string,
  ) {
    this.cacheKey = `game:${room ?? 'solo'}:${date}`;
    this.path = room && firebaseEnabled ? `rooms/${room}/games/${date}` : null;
    this.init();
  }

  private async init() {
    const cache = await loadJSON<Cache>(this.cacheKey);
    if (this.closed) return;
    if (cache) {
      this.pending = cache.pending ?? {};
      this.pendingHints = cache.pendingHints ?? {};
      this.state = {
        cells: cache.cells ?? {},
        hints: cache.hints ?? {},
        startedAt: cache.startedAt ?? null,
        finishedAt: cache.finishedAt ?? null,
        loaded: true,
      };
    } else {
      this.state = { ...this.state, loaded: true };
    }
    this.emit();
    const d = database();
    if (d && this.path) {
      // reenviar lo que quedó pendiente de una sesión anterior sin conexión
      for (const [k, op] of Object.entries(this.pending)) this.push(k, op);
      for (const [id, h] of Object.entries(this.pendingHints)) this.pushHint(id, h);
      if (this.state.startedAt) this.pushStart(this.state.startedAt);
      this.off = onValue(ref(d, this.path), (snap) => {
        const v = (snap.val() ?? {}) as Partial<Cache>;
        this.remote = {
          cells: (v.cells ?? {}) as Cells,
          hints: (v.hints ?? {}) as Record<string, HintEntry>,
          startedAt: v.startedAt ?? null,
          finishedAt: v.finishedAt ?? null,
        };
        this.rebuild();
      });
    }
  }

  /** Estado visible = lo que dice el servidor + mis cambios aún no confirmados. */
  private rebuild() {
    if (this.remote) {
      const cells: Cells = { ...this.remote.cells };
      for (const [k, op] of Object.entries(this.pending)) {
        if (op.cell) cells[k] = op.cell;
        else delete cells[k];
      }
      this.state = {
        cells,
        hints: { ...this.remote.hints, ...this.pendingHints },
        startedAt: this.remote.startedAt ?? this.state.startedAt,
        finishedAt: this.remote.finishedAt ?? this.state.finishedAt,
        loaded: true,
      };
    }
    this.emit();
  }

  private emit() {
    const s = this.state;
    this.listeners.forEach((l) => l(s));
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.persist(), 250);
  }

  private persist() {
    const c: Cache = {
      cells: this.state.cells,
      hints: this.state.hints,
      startedAt: this.state.startedAt,
      finishedAt: this.state.finishedAt,
      pending: this.pending,
      pendingHints: this.pendingHints,
    };
    saveJSON(this.cacheKey, c);
  }

  private push(k: string, op: PendingOp) {
    const d = database();
    if (!d || !this.path) return;
    const r = ref(d, `${this.path}/cells/${k}`);
    (op.cell ? set(r, op.cell) : remove(r))
      .then(() => {
        if (this.pending[k] === op) {
          delete this.pending[k];
          this.persist();
        }
      })
      .catch(() => {});
  }

  private pushHint(id: string, h: HintEntry) {
    const d = database();
    if (!d || !this.path) return;
    set(ref(d, `${this.path}/hints/${id}`), h)
      .then(() => {
        delete this.pendingHints[id];
        this.persist();
      })
      .catch(() => {});
  }

  private pushStart(t: number) {
    const d = database();
    if (!d || !this.path) return;
    runTransaction(ref(d, `${this.path}/startedAt`), (cur) => cur ?? t).catch(() => {});
  }

  subscribe(cb: (s: GameState) => void): () => void {
    this.listeners.add(cb);
    cb(this.state);
    return () => {
      this.listeners.delete(cb);
    };
  }

  get current(): GameState {
    return this.state;
  }

  setCell(k: string, letter: string | null, hint = false) {
    const entry: CellEntry | null = letter ? { l: letter, by: this.uid, t: now(), ...(hint ? { h: true } : {}) } : null;
    const cells = { ...this.state.cells };
    if (entry) cells[k] = entry;
    else delete cells[k];
    let startedAt = this.state.startedAt;
    if (entry && !startedAt) {
      startedAt = now();
      this.pushStart(startedAt);
    }
    this.state = { ...this.state, cells, startedAt };
    if (this.path) {
      const op: PendingOp = { cell: entry };
      this.pending[k] = op;
      this.push(k, op);
    }
    this.emit();
  }

  addHint(cost: number) {
    const id = randomId(10);
    const h: HintEntry = { by: this.uid, cost };
    this.state = { ...this.state, hints: { ...this.state.hints, [id]: h } };
    if (this.path) {
      this.pendingHints[id] = h;
      this.pushHint(id, h);
    }
    this.emit();
  }

  /** Marca la partida como terminada y guarda el resultado del día (una sola vez). */
  finish(result: Omit<DayResult, 'finishedAt'>) {
    if (this.state.finishedAt) return;
    const finishedAt = now();
    this.state = { ...this.state, finishedAt };
    const d = database();
    if (d && this.path) runTransaction(ref(d, `${this.path}/finishedAt`), (cur) => cur ?? finishedAt).catch(() => {});
    saveResult(this.room, this.date, { ...result, finishedAt });
    this.emit();
  }

  close() {
    this.closed = true;
    this.off?.();
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.persist();
    this.listeners.clear();
  }
}

/** Progreso guardado en el móvil de una fecha (para la portada y el archivo). */
export async function cachedProgress(room: string | null, date: string): Promise<{ cells: Cells; finishedAt: number | null } | null> {
  const c = await loadJSON<Cache>(`game:${room ?? 'solo'}:${date}`);
  return c ? { cells: c.cells ?? {}, finishedAt: c.finishedAt ?? null } : null;
}
