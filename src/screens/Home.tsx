import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firebaseEnabled } from '../config';
import { computeStats, derive, formatTime, type Cells } from '../logic';
import { addDays, key, prettyDate, puzzleForDate, today, type Puzzle } from '../puzzles';
import { GameSession, sendSignal, type GameState } from '../sync';
import { ntfy } from '../notify';
import { alpha, colorHex, fonts, radius, space, type Theme } from '../theme';
import { Avatar, Body, useApp } from '../ui';

/** La rejilla del día en miniatura: sirve de ilustración y enseña el avance. */
function MiniGrid({ puzzle, cells, colors, size }: { puzzle: Puzzle; cells: Cells; colors: Record<string, string>; size: number }) {
  const rows = [];
  for (let r = 0; r < puzzle.h; r++) {
    const row = [];
    for (let c = 0; c < puzzle.w; c++) {
      const k = key(r, c);
      const white = puzzle.solution[k] !== undefined;
      const e = cells[k];
      row.push(
        <View
          key={k}
          style={{
            width: size,
            height: size,
            margin: 1,
            borderRadius: 1.5,
            backgroundColor: !white ? '#FFC53D' : e ? (colors[e.by] ?? '#1C2140') : '#FFFFFF',
          }}
        />,
      );
    }
    rows.push(
      <View key={r} style={{ flexDirection: 'row' }}>
        {row}
      </View>,
    );
  }
  return <View style={{ transform: [{ rotate: '4deg' }] }}>{rows}</View>;
}

/** Pictogramas dibujados con formas simples (sin emojis). */
function Glyph({ kind, color }: { kind: 'archive' | 'score' | 'pair' | 'settings'; color: string }) {
  const box = { width: 46, height: 46 } as const;
  if (kind === 'archive') {
    return (
      <View style={[box, { flexDirection: 'row', flexWrap: 'wrap', gap: 4 }]}>
        {[1, 1, 0.45, 1, 0.45, 1, 0.45, 1, 1].map((o, i) => (
          <View key={i} style={{ width: 12.6, height: 12.6, borderRadius: 2, backgroundColor: color, opacity: o }} />
        ))}
      </View>
    );
  }
  if (kind === 'score') {
    return (
      <View style={[box, { flexDirection: 'row', alignItems: 'flex-end', gap: 5 }]}>
        {[26, 46, 16].map((h, i) => (
          <View key={i} style={{ flex: 1, height: h, borderRadius: 2, backgroundColor: color }} />
        ))}
      </View>
    );
  }
  if (kind === 'pair') {
    return (
      <View style={box}>
        <View style={{ position: 'absolute', left: 0, top: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: color }} />
        <View style={{ position: 'absolute', right: 0, top: 8, width: 30, height: 30, borderRadius: 15, borderWidth: 4, borderColor: color }} />
      </View>
    );
  }
  return (
    <View style={[box, { justifyContent: 'space-around', paddingVertical: 4 }]}>
      {[10, 28, 18].map((x, i) => (
        <View key={i} style={{ height: 4, borderRadius: 2, backgroundColor: color, justifyContent: 'center' }}>
          <View style={{ position: 'absolute', left: x, width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />
        </View>
      ))}
    </View>
  );
}

export function HomeScreen() {
  const app = useApp();
  const { theme, profile, partner } = app;
  const insets = useSafeAreaInsets();
  const date = today();
  const puzzle = useMemo(() => puzzleForDate(date), [date]);
  const [state, setState] = useState<GameState | null>(null);
  const [poked, setPoked] = useState(false);

  useEffect(() => {
    const s = new GameSession(profile.room, date, profile.uid, true);
    const off = s.subscribe(setState);
    return () => {
      off();
      s.close();
    };
  }, [profile.room, profile.uid, date]);

  const d = useMemo(() => (state ? derive(puzzle, state.cells, state.hints) : null), [state, puzzle]);
  const stats = useMemo(() => computeStats(app.results, date, (x) => addDays(x, -1)), [app.results, date]);
  const started = !!state && Object.keys(state.cells).length > 0;
  const done = !!d?.complete;
  const partnerPresence = partner ? app.presence[partner.uid] : undefined;
  const partnerPlaying = !!partnerPresence && partnerPresence.date === date && !!partnerPresence.k;
  const colors = useMemo(() => {
    const m: Record<string, string> = { [profile.uid]: colorHex(profile.color) };
    Object.values(app.players).forEach((p) => (m[p.uid] = colorHex(p.color)));
    return m;
  }, [app.players, profile.uid, profile.color]);

  const poke = async () => {
    if (!partner) return;
    setPoked(true);
    sendSignal(profile.room, { by: profile.uid, kind: 'poke' });
    const ok = await ntfy(partner.topic, `${profile.name} te da un toque`, `Te invita a jugar el autodefinido de hoy (n.º ${puzzle.n}).`, ['wave']);
    app.toast(ok ? `Toque enviado a ${partner.name}` : 'No se pudo enviar el aviso');
    setTimeout(() => setPoked(false), 8000);
  };

  const board = d ? (done ? d.scores : d.placed) : {};
  const unit = done ? 'puntos' : 'letras';
  let status = `${puzzle.words.length} palabras por resolver`;
  if (done && state?.startedAt && state.finishedAt) status = `Resuelto en ${formatTime((state.finishedAt - state.startedAt) / 1000)}`;
  else if (started && d) status = `${d.filled} de ${puzzle.whiteCount} letras escritas`;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: insets.bottom + space.xl, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: space.xs }}>
          <View>
            <Text style={{ fontFamily: fonts.titleBold, fontSize: 52, lineHeight: 56, color: theme.ink, letterSpacing: -2.5 }}>Dúo</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 17, color: theme.inkSoft }}>{prettyDate(date)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Avatar name={profile.name} color={profile.color} size={42} />
            {partner && (
              <View style={{ marginLeft: -10, borderWidth: 2, borderColor: theme.bg, borderRadius: 24 }}>
                <Avatar name={partner.name} color={partner.color} size={42} ring={!!partnerPresence} />
              </View>
            )}
          </View>
        </View>

        {/* el autodefinido de hoy, como la portada de una revista de pasatiempos */}
        <View style={{ backgroundColor: theme.cobalt, borderRadius: radius.lg, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', padding: space.xl, paddingBottom: space.lg }}>
            <View style={{ flex: 1, justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: '#FFFFFF' }}>Autodefinido n.º</Text>
                <Text style={{ fontFamily: fonts.titleBold, fontSize: 92, lineHeight: 96, color: '#FFC53D', letterSpacing: -5, marginTop: -6 }}>{puzzle.n}</Text>
              </View>
              <View style={{ gap: 2 }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: '#FFFFFF' }}>{status}</Text>
                {stats.streak > 0 && (
                  <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: '#FFC53D' }}>
                    Racha de {stats.streak} {stats.streak === 1 ? 'día' : 'días'}
                  </Text>
                )}
                {partnerPlaying && !done && <Text style={{ fontFamily: fonts.hand, fontSize: 20, color: '#FFFFFF' }}>{partner!.name} está jugando ahora</Text>}
              </View>
            </View>
            <View style={{ justifyContent: 'center', paddingLeft: space.md, paddingRight: 4 }}>
              <MiniGrid puzzle={puzzle} cells={state?.cells ?? {}} colors={colors} size={11} />
            </View>
          </View>

          {(started || done) && d && (
            <View style={{ flexDirection: 'row', gap: space.xl, paddingHorizontal: space.xl, paddingBottom: space.md }}>
              <ScoreLine name={profile.name} score={board[profile.uid] ?? 0} unit={unit} />
              {partner && <ScoreLine name={partner.name} score={board[partner.uid] ?? 0} unit={unit} />}
            </View>
          )}

          <Pressable
            onPress={() => app.go({ name: 'game', date })}
            accessibilityRole="button"
            style={({ pressed }) => ({ backgroundColor: '#FFC53D', paddingVertical: 17, alignItems: 'center', opacity: pressed ? 0.85 : 1 })}
          >
            <Text style={{ fontFamily: fonts.titleBold, fontSize: 20, color: '#1C2140', letterSpacing: -0.5 }}>
              {done ? 'Ver resultado' : started ? 'Continuar' : 'Jugar'}
            </Text>
          </Pressable>
        </View>

        {partner && !done && (
          <Pressable
            onPress={poke}
            disabled={poked}
            accessibilityRole="button"
            style={({ pressed }) => ({ borderRadius: radius.sm, paddingVertical: 13, alignItems: 'center', borderWidth: 1.5, borderColor: theme.ink, opacity: poked ? 0.45 : pressed ? 0.7 : 1 })}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: theme.ink }}>{poked ? 'Toque enviado' : `Dar un toque a ${partner.name}`}</Text>
          </Pressable>
        )}

        {/* emparejamiento */}
        {!profile.room && (
          <Pressable onPress={() => app.go({ name: 'pair' })} style={{ borderWidth: 1.5, borderColor: theme.ink, borderRadius: radius.lg, padding: space.lg, gap: 4, backgroundColor: theme.card }}>
            <Text style={{ fontFamily: fonts.title, fontSize: 20, color: theme.ink, letterSpacing: -0.6 }}>Invita a tu pareja de juego</Text>
            <Body soft>
              {firebaseEnabled
                ? 'Crea una sala y envía la invitación para resolverlo a la vez desde los dos móviles.'
                : 'Ahora mismo juegas solo en este móvil. Falta conectar la base de datos para jugar a dos.'}
            </Body>
          </Pressable>
        )}
        {profile.room && !partner && (
          <Pressable onPress={() => app.go({ name: 'pair' })} style={{ borderWidth: 1.5, borderColor: theme.ink, borderRadius: radius.lg, padding: space.lg, gap: 4, backgroundColor: theme.card }}>
            <Text style={{ fontFamily: fonts.title, fontSize: 20, color: theme.ink, letterSpacing: -0.6 }}>Esperando a la otra persona</Text>
            <Body soft>Tu sala es {profile.room}. Toca para reenviar la invitación.</Body>
          </Pressable>
        )}

        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Tile theme={theme} kind="archive" bg={theme.tomato} fg="#FFFFFF" title="Archivo" sub="Días anteriores" onPress={() => app.go({ name: 'archive' })} />
          <Tile theme={theme} kind="score" bg={theme.yellow} fg="#1C2140" title="Marcador" sub={`${stats.played} completados`} onPress={() => app.go({ name: 'stats' })} />
        </View>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Tile theme={theme} kind="pair" bg={theme.mint} fg="#FFFFFF" title="Pareja" sub={partner ? `Con ${partner.name}` : 'Invitar'} onPress={() => app.go({ name: 'pair' })} />
          <Tile theme={theme} kind="settings" bg={theme.dark ? '#EEF0F8' : '#1C2140'} fg={theme.dark ? '#1C2140' : '#FFFFFF'} title="Ajustes" sub="Avisos y perfil" onPress={() => app.go({ name: 'settings' })} />
        </View>
      </ScrollView>
    </View>
  );
}

function ScoreLine({ name, score, unit }: { name: string; score: number; unit: string }) {
  return (
    <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: alpha('#FFFFFF', 0.85) }}>
      {name} <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: '#FFFFFF' }}>{score}</Text> {unit}
    </Text>
  );
}

function Tile({
  kind,
  bg,
  fg,
  title,
  sub,
  onPress,
}: {
  theme: Theme;
  kind: 'archive' | 'score' | 'pair' | 'settings';
  bg: string;
  fg: string;
  title: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ flex: 1, backgroundColor: bg, borderRadius: radius.lg, padding: space.lg, gap: 14, opacity: pressed ? 0.8 : 1 })}
    >
      <Glyph kind={kind} color={fg} />
      <View>
        <Text style={{ fontFamily: fonts.title, fontSize: 23, color: fg, letterSpacing: -0.8 }}>{title}</Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: fg, opacity: 0.8 }} numberOfLines={1}>
          {sub}
        </Text>
      </View>
    </Pressable>
  );
}
