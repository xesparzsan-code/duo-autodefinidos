import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Grid } from '../Grid';
import { derive, formatTime, type Derived } from '../logic';
import { puzzleForDate, prettyDate, today, type Puzzle } from '../puzzles';
import { GameSession, now, sendSignal, setPresence, type GameState } from '../sync';
import { ntfy } from '../notify';
import { POINTS } from '../config';
import { loadJSON, saveJSON } from '../storage';
import { alpha, colorHex, fonts, radius, space } from '../theme';
import { Avatar, Button, tap, useApp } from '../ui';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNM'];
const EMOJIS = ['👏', '😂', '🔥', '🤔', '😱', '❤️'];

type Sel = { k: string; dir: 'A' | 'D' };

function wordAt(puzzle: Puzzle, sel: Sel | null): number | null {
  if (!sel) return null;
  const ids = puzzle.wordsAt[sel.k] ?? [];
  const same = ids.find((id) => puzzle.words[id].dir === sel.dir);
  return same ?? ids[0] ?? null;
}

export function GameScreen({ date }: { date: string }) {
  const app = useApp();
  const { theme, profile, partner } = app;
  const insets = useSafeAreaInsets();
  const dims = useWindowDimensions();
  const puzzle = useMemo(() => puzzleForDate(date), [date]);

  const [state, setState] = useState<GameState>({ cells: {}, hints: {}, startedAt: null, finishedAt: null, loaded: false });
  const [sel, setSel] = useState<Sel | null>(null);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [showEmojis, setShowEmojis] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [tick, setTick] = useState(0);
  const sessionRef = useRef<GameSession | null>(null);
  const resultShown = useRef(false);

  // --- sesión de juego
  useEffect(() => {
    const s = new GameSession(profile.room, date, profile.uid);
    sessionRef.current = s;
    const off = s.subscribe(setState);
    return () => {
      off();
      s.close();
      sessionRef.current = null;
      setPresence(profile.room, profile.uid, {});
    };
  }, [profile.room, profile.uid, date]);

  const derived: Derived = useMemo(() => derive(puzzle, state.cells, state.hints), [puzzle, state.cells, state.hints]);
  const active = wordAt(puzzle, sel);

  // --- selección inicial: primera palabra sin terminar
  useEffect(() => {
    if (state.loaded && !sel) {
      const w = puzzle.words.find((x) => !derived.filledWords.has(x.id)) ?? puzzle.words[0];
      const k = w.cells.find((c) => !state.cells[c]) ?? w.cells[0];
      setSel({ k, dir: w.dir });
    }
  }, [state.loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- presencia (dónde estoy escribiendo)
  useEffect(() => {
    if (sel) setPresence(profile.room, profile.uid, { date, k: sel.k, dir: sel.dir });
  }, [sel, profile.room, profile.uid, date]);

  // --- temporizador
  useEffect(() => {
    if (!state.startedAt || state.finishedAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [state.startedAt, state.finishedAt]);
  void tick;
  const secs = state.startedAt ? ((state.finishedAt ?? now()) - state.startedAt) / 1000 : 0;

  // --- final de partida
  useEffect(() => {
    if (!state.loaded || !derived.complete) return;
    if (!state.finishedAt) {
      const startedAt = state.startedAt ?? now();
      sessionRef.current?.finish({ scores: derived.scores, secs: Math.round((now() - startedAt) / 1000), n: puzzle.n });
      // avisa quien puso la última letra
      const last = Object.values(state.cells).sort((a, b) => b.t - a.t)[0];
      if (partner && last?.by === profile.uid) {
        const mine = derived.scores[profile.uid] ?? 0;
        const theirs = derived.scores[partner.uid] ?? 0;
        ntfy(partner.topic, 'Autodefinido completado', `${profile.name} ${mine} – ${theirs} ${partner.name}`, ['tada']);
      }
    }
    if (!resultShown.current) {
      resultShown.current = true;
      // si ya estaba terminado al entrar no se enseña el resumen de golpe
      if (!state.finishedAt || now() - state.finishedAt < 5000) {
        setShowResult(true);
        if (Platform.OS !== 'web' && profile.haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    }
  }, [derived.complete, state.loaded, state.finishedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- aviso "ha empezado a jugar" (una vez por día)
  const notifyStart = useCallback(async () => {
    if (!partner || date !== today()) return;
    const flag = `aviso-inicio:${date}`;
    if (await loadJSON<boolean>(flag)) return;
    saveJSON(flag, true);
    ntfy(partner.topic, `${profile.name} está jugando`, 'Ha empezado el autodefinido de hoy. ¡Entra antes de que se lleve todos los puntos!', ['pencil2']);
  }, [partner, date, profile.name]);

  // --- movimiento
  const moveTo = useCallback(
    (k: string, dir?: 'A' | 'D') => {
      setSel((cur) => {
        const ids = puzzle.wordsAt[k] ?? [];
        const dirs = ids.map((id) => puzzle.words[id].dir);
        let d = dir ?? cur?.dir ?? 'A';
        if (!dir && cur?.k === k && dirs.length > 1) d = cur.dir === 'A' ? 'D' : 'A';
        if (!dirs.includes(d)) d = dirs[0] ?? d;
        return { k, dir: d };
      });
    },
    [puzzle],
  );

  const onPressCell = useCallback(
    (k: string) => {
      tap(profile.haptics);
      moveTo(k);
    },
    [moveTo, profile.haptics],
  );

  const selectWord = useCallback(
    (id: number) => {
      const w = puzzle.words[id];
      const cells = sessionRef.current?.current.cells ?? {};
      const k = w.cells.find((c) => !cells[c]) ?? w.cells[0];
      setSel({ k, dir: w.dir });
    },
    [puzzle],
  );

  const stepWord = (delta: 1 | -1) => {
    const n = puzzle.words.length;
    let id = active ?? 0;
    for (let i = 0; i < n; i++) {
      id = (id + delta + n) % n;
      if (!derived.filledWords.has(id)) break;
    }
    selectWord(id);
  };

  const typeLetter = (letter: string) => {
    const s = sessionRef.current;
    if (!s || !sel || active === null || derived.complete) return;
    tap(profile.haptics);
    const w = puzzle.words[active];
    const idx = w.cells.indexOf(sel.k);
    if (!derived.confirmed.has(sel.k) && state.cells[sel.k]?.l !== letter) {
      const first = !Object.values(state.cells).some((c) => c.by === profile.uid);
      s.setCell(sel.k, letter);
      if (first) notifyStart();
    }
    const cells = s.current.cells;
    const d = derive(puzzle, cells, state.hints);
    if (d.filled === puzzle.whiteCount && !d.complete && derived.filled < puzzle.whiteCount) {
      app.toast('Está todo escrito, pero hay alguna letra incorrecta');
    }
    // avanzar: siguiente casilla vacía de la palabra o, si no hay, la siguiente sin fijar
    const rest = w.cells.slice(idx + 1);
    const next = rest.find((c) => !cells[c]) ?? rest.find((c) => !d.confirmed.has(c));
    if (next) {
      setSel({ k: next, dir: w.dir });
      return;
    }
    // final de la palabra: si ya está escrita entera, saltar a la siguiente con huecos
    if (d.filledWords.has(w.id)) {
      const n = puzzle.words.length;
      for (let i = 1; i < n; i++) {
        const cand = puzzle.words[(w.id + i) % n];
        if (!d.filledWords.has(cand.id)) {
          setSel({ k: cand.cells.find((c) => !cells[c]) ?? cand.cells[0], dir: cand.dir });
          return;
        }
      }
    }
  };

  const backspace = () => {
    const s = sessionRef.current;
    if (!s || !sel || active === null || derived.complete) return;
    tap(profile.haptics);
    const w = puzzle.words[active];
    const idx = w.cells.indexOf(sel.k);
    if (state.cells[sel.k] && !derived.confirmed.has(sel.k)) {
      s.setCell(sel.k, null);
      return;
    }
    if (idx > 0) {
      const prev = w.cells[idx - 1];
      if (state.cells[prev] && !derived.confirmed.has(prev)) s.setCell(prev, null);
      setSel({ k: prev, dir: w.dir });
    }
  };

  const hintLetter = () => {
    const s = sessionRef.current;
    if (!s || !sel) return;
    if (derived.confirmed.has(sel.k)) {
      app.toast('Esa casilla ya está comprobada');
      return;
    }
    s.setCell(sel.k, puzzle.solution[sel.k], true);
    s.addHint(POINTS.hintLetter);
    app.toast(`Letra revelada (${POINTS.hintLetter} puntos)`);
  };

  const checkWord = () => {
    const s = sessionRef.current;
    if (!s || active === null) return;
    const w = puzzle.words[active];
    const pend = w.cells.filter((c) => state.cells[c] && !derived.confirmed.has(c));
    if (pend.length === 0) {
      app.toast(w.cells.some((c) => !state.cells[c]) ? 'Escribe alguna letra primero' : 'Esa palabra ya está comprobada');
      return;
    }
    const wrong = pend.filter((c) => state.cells[c].l !== puzzle.solution[c]);
    const right = pend.filter((c) => state.cells[c].l === puzzle.solution[c]);
    s.addHint(POINTS.checkWord);
    // las letras correctas quedan fijas; las incorrectas se borran
    right.forEach((c) => s.markOk(c));
    if (wrong.length === 0) {
      app.toast(`Todas las letras escritas son correctas (${POINTS.checkWord} puntos)`);
      return;
    }
    setFlash(new Set(wrong));
    setTimeout(() => {
      wrong.forEach((c) => {
        const cur = sessionRef.current?.current.cells[c];
        // solo se borra si nadie la ha cambiado mientras tanto
        if (cur && cur.l !== puzzle.solution[c]) sessionRef.current?.setCell(c, null);
      });
      setFlash(new Set());
    }, 650);
    app.toast(`${wrong.length} ${wrong.length === 1 ? 'letra incorrecta' : 'letras incorrectas'} (${POINTS.checkWord} puntos)`);
  };

  // --- teclado físico (web / tablet con teclado)
  const handlers = useRef({ typeLetter, backspace });
  handlers.current = { typeLetter, backspace };
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      const ch = e.key.toUpperCase();
      if (/^[A-ZÑ]$/.test(ch)) handlers.current.typeLetter(ch);
      else if (e.key === 'Backspace') handlers.current.backspace();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // --- colores y cursor del compañero
  const colors = useMemo(() => {
    const m: Record<string, string> = { [profile.uid]: colorHex(profile.color) };
    Object.values(app.players).forEach((p) => (m[p.uid] = colorHex(p.color)));
    return m;
  }, [app.players, profile.uid, profile.color]);

  const partnerCursor = useMemo(() => {
    if (!partner) return null;
    const pr = app.presence[partner.uid];
    if (!pr || pr.date !== date || !pr.k) return null;
    const id = wordAt(puzzle, { k: pr.k, dir: pr.dir ?? 'A' });
    return { k: pr.k, word: new Set(id !== null ? puzzle.words[id].cells : []), color: colorHex(partner.color) };
  }, [partner, app.presence, date, puzzle]);

  // --- medidas
  const chrome = 52 + 56 + 40 + 3 * 46 + 22;
  const availH = dims.height - insets.top - insets.bottom - chrome;
  const byWidth = Math.floor((Math.min(dims.width, 520) - 10) / puzzle.w);
  const cell = Math.min(byWidth, Math.max(Math.floor(availH / puzzle.h), 34));
  const keyW = Math.min((Math.min(dims.width, 520) - 8) / 10, 52);

  const board = derived.complete ? derived.scores : derived.placed;
  const unit = derived.complete ? 'puntos' : 'letras';
  const myScore = board[profile.uid] ?? 0;
  const partnerScore = partner ? (board[partner.uid] ?? 0) : 0;
  const activeWord = active !== null ? puzzle.words[active] : null;
  const pattern = activeWord ? activeWord.cells.map((c) => state.cells[c]?.l ?? '·').join(' ') : '';

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {/* cabecera con marcador */}
      <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, gap: space.sm }}>
        <Pressable onPress={() => app.go({ name: 'home' })} hitSlop={12} accessibilityRole="button" accessibilityLabel="Volver">
          <Text style={{ fontFamily: fonts.medium, fontSize: 28, color: theme.ink, marginTop: -4, paddingRight: 4 }}>‹</Text>
        </Pressable>
        <ScoreChip name={profile.name} color={profile.color} score={myScore} unit={unit} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: theme.ink, fontVariant: ['tabular-nums'] }}>{formatTime(secs)}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 10.5, color: theme.inkFaint }}>
            {app.online || !profile.room ? `N.º ${puzzle.n}` : 'Sin conexión · se guardará'}
          </Text>
        </View>
        {partner ? (
          <ScoreChip name={partner.name} color={partner.color} score={partnerScore} unit={unit} right live={!!partnerCursor} />
        ) : (
          <View style={{ width: 70 }} />
        )}
      </View>

      {/* rejilla */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 4 }} bounces={false}>
        <Grid
          puzzle={puzzle}
          cells={state.cells}
          derived={derived}
          colors={colors}
          theme={theme}
          size={cell}
          selected={sel?.k ?? null}
          activeWord={active}
          partner={partnerCursor}
          flash={flash}
          onPressCell={onPressCell}
          onPressClue={selectWord}
        />
      </ScrollView>

      {/* definición activa */}
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.line }}>
        <Pressable onPress={() => stepWord(-1)} hitSlop={8} style={{ paddingHorizontal: 14, height: '100%', justifyContent: 'center' }} accessibilityLabel="Definición anterior">
          <Text style={{ fontSize: 24, color: theme.inkSoft, fontFamily: fonts.medium }}>‹</Text>
        </Pressable>
        <Pressable style={{ flex: 1, alignItems: 'center' }} onPress={() => sel && moveTo(sel.k)}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.title, fontSize: 18, color: theme.ink }}>
            {activeWord?.clue ?? ''}
          </Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: theme.inkFaint, letterSpacing: 1 }}>
            {activeWord ? `${activeWord.dir === 'A' ? '→' : '↓'}  ${pattern}` : ''}
          </Text>
        </Pressable>
        <Pressable onPress={() => stepWord(1)} hitSlop={8} style={{ paddingHorizontal: 14, height: '100%', justifyContent: 'center' }} accessibilityLabel="Definición siguiente">
          <Text style={{ fontSize: 24, color: theme.inkSoft, fontFamily: fonts.medium }}>›</Text>
        </Pressable>
      </View>

      {/* acciones */}
      <View style={{ height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: space.sm }}>
        <Action label={`Letra ${POINTS.hintLetter}`} icon="💡" onPress={hintLetter} disabled={derived.complete} />
        <Action label={`Comprobar ${POINTS.checkWord}`} icon="✓" onPress={checkWord} disabled={derived.complete} />
        {partner && <Action label="Reacción" icon="😊" onPress={() => setShowEmojis((v) => !v)} />}
        {derived.complete && <Action label="Resumen" icon="🏁" onPress={() => setShowResult(true)} />}
      </View>

      {/* teclado */}
      <View style={{ paddingBottom: 6, paddingTop: 2, alignItems: 'center' }}>
        {ROWS.map((row, i) => (
          <View key={row} style={{ flexDirection: 'row', justifyContent: 'center' }}>
            {row.split('').map((ch) => (
              <Key key={ch} label={ch} w={keyW} onPress={() => typeLetter(ch)} />
            ))}
            {i === 2 && <Key label="⌫" w={keyW * 1.6} onPress={backspace} />}
          </View>
        ))}
      </View>

      {showEmojis && (
        <View style={{ position: 'absolute', bottom: insets.bottom + 3 * 46 + 60, alignSelf: 'center', flexDirection: 'row', backgroundColor: theme.card, borderRadius: 999, padding: 6, gap: 2, borderWidth: 1, borderColor: theme.line, elevation: 6, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
          {EMOJIS.map((e) => (
            <Pressable
              key={e}
              onPress={() => {
                sendSignal(profile.room, { by: profile.uid, kind: 'emoji', emoji: e });
                setShowEmojis(false);
                app.toast(`${e} enviado`);
              }}
              style={{ padding: 8 }}
            >
              <Text style={{ fontSize: 24 }}>{e}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {showResult && (
        <ResultModal
          onClose={() => setShowResult(false)}
          date={date}
          n={puzzle.n}
          secs={secs}
          derived={derived}
        />
      )}
    </View>
  );
}

function ScoreChip({ name, color, score, unit, right, live }: { name: string; color: string; score: number; unit: string; right?: boolean; live?: boolean }) {
  const { theme } = useApp();
  return (
    <View style={{ flexDirection: right ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, minWidth: 70 }}>
      <Avatar name={name} color={color} size={30} ring={live} />
      <View style={{ alignItems: right ? 'flex-end' : 'flex-start' }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 10.5, color: theme.inkFaint, maxWidth: 64 }}>
          {name}
        </Text>
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colorHex(color), fontVariant: ['tabular-nums'] }}>
          {score}
          <Text style={{ fontFamily: fonts.body, fontSize: 10, color: theme.inkFaint }}> {unit}</Text>
        </Text>
      </View>
    </View>
  );
}

function Action({ label, icon, onPress, disabled }: { label: string; icon: string; onPress: () => void; disabled?: boolean }) {
  const { theme } = useApp();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 11,
        height: 30,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: theme.line,
        backgroundColor: theme.card,
        opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ fontSize: 12, color: theme.ink }}>{icon}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: theme.ink }}>{label}</Text>
    </Pressable>
  );
}

function Key({ label, w, onPress }: { label: string; w: number; onPress: () => void }) {
  const { theme } = useApp();
  return (
    <Pressable onPress={onPress} accessibilityLabel={label === '⌫' ? 'Borrar' : label} style={{ width: w, height: 46, padding: 2.5 }}>
      {({ pressed }) => (
        <View
          style={{
            flex: 1,
            borderRadius: 7,
            backgroundColor: pressed ? theme.active : theme.key,
            alignItems: 'center',
            justifyContent: 'center',
            borderBottomWidth: 1.5,
            borderColor: theme.line,
          }}
        >
          <Text style={{ fontFamily: fonts.medium, fontSize: 18, color: theme.keyText }}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

function ResultModal({ onClose, date, n, secs, derived }: { onClose: () => void; date: string; n: number; secs: number; derived: Derived }) {
  const app = useApp();
  const { theme, profile, partner } = app;
  const mine = derived.scores[profile.uid] ?? 0;
  const theirs = partner ? (derived.scores[partner.uid] ?? 0) : 0;
  const title = !partner ? '¡Completado!' : mine === theirs ? '¡Empate!' : mine > theirs ? `Gana ${profile.name}` : `Gana ${partner.name}`;
  const rows = [
    { p: { name: profile.name, color: profile.color, uid: profile.uid }, score: mine },
    ...(partner ? [{ p: partner, score: theirs }] : []),
  ].sort((a, b) => b.score - a.score);
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: alpha('#0E1318', 0.55), alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
      <View style={{ width: '100%', maxWidth: 380, backgroundColor: theme.card, borderRadius: radius.lg, padding: space.xl, gap: space.lg }}>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 40 }}>🏁</Text>
          <Text style={{ fontFamily: fonts.titleBold, fontSize: 26, color: theme.ink, textAlign: 'center' }}>{title}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: theme.inkSoft }}>
            N.º {n} · {prettyDate(date, false)} · {formatTime(secs)}
          </Text>
        </View>
        {rows.map(({ p, score }) => (
          <View key={p.uid} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Avatar name={p.name} color={p.color} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: theme.ink }}>{p.name}</Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: theme.inkSoft }}>
                {derived.letters[p.uid] ?? 0} letras · {derived.wordsBy[p.uid] ?? 0} palabras rematadas
              </Text>
            </View>
            <Text style={{ fontFamily: fonts.titleBold, fontSize: 26, color: colorHex(p.color) }}>{score}</Text>
          </View>
        ))}
        <Button label="Cerrar" onPress={onClose} />
        <Button label="Volver al inicio" kind="ghost" onPress={() => app.go({ name: 'home' })} />
      </View>
    </View>
  );
}
