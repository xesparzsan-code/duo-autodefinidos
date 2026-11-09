import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firebaseEnabled } from '../config';
import { computeStats, derive, formatTime } from '../logic';
import { addDays, prettyDate, puzzleForDate, today } from '../puzzles';
import { GameSession, sendSignal, type GameState } from '../sync';
import { ntfy } from '../notify';
import { alpha, colorHex, fonts, radius, space } from '../theme';
import { Avatar, Body, Button, Card, Label, useApp } from '../ui';

export function HomeScreen() {
  const app = useApp();
  const { theme, profile, partner } = app;
  const insets = useSafeAreaInsets();
  const date = today();
  const puzzle = useMemo(() => puzzleForDate(date), [date]);
  const [state, setState] = useState<GameState | null>(null);
  const [poked, setPoked] = useState(false);

  useEffect(() => {
    const s = new GameSession(profile.room, date, profile.uid);
    const off = s.subscribe(setState);
    return () => {
      off();
      s.close();
    };
  }, [profile.room, profile.uid, date]);

  const d = useMemo(() => (state ? derive(puzzle, state.cells, state.hints) : null), [state, puzzle]);
  const stats = useMemo(() => computeStats(app.results, date, (x) => addDays(x, -1)), [app.results, date]);
  const progress = d ? d.confirmed.size / puzzle.whiteCount : 0;
  const started = !!state && Object.keys(state.cells).length > 0;
  const done = !!d?.complete;
  const partnerPresence = partner ? app.presence[partner.uid] : undefined;
  const partnerPlaying = !!partnerPresence && partnerPresence.date === date && !!partnerPresence.k;

  const poke = async () => {
    if (!partner) return;
    setPoked(true);
    sendSignal(profile.room, { by: profile.uid, kind: 'poke' });
    const ok = await ntfy(partner.topic, `${profile.name} te da un toque`, `Te invita a jugar el autodefinido de hoy (n.º ${puzzle.n}).`, ['wave']);
    app.toast(ok ? `Toque enviado a ${partner.name}` : 'No se pudo enviar el aviso');
    setTimeout(() => setPoked(false), 8000);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: insets.bottom + space.xl, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm }}>
          <View>
            <Text style={{ fontFamily: fonts.titleBold, fontSize: 34, color: theme.ink, letterSpacing: -0.8 }}>Dúo</Text>
            <Body soft>Hola, {profile.name}</Body>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar name={profile.name} color={profile.color} size={40} />
            {partner && (
              <View style={{ marginLeft: -10, borderWidth: 2, borderColor: theme.bg, borderRadius: 24 }}>
                <Avatar name={partner.name} color={partner.color} size={40} ring={!!partnerPresence} />
              </View>
            )}
          </View>
        </View>

        {/* autodefinido de hoy */}
        <Card style={{ gap: space.md, padding: space.xl }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>Autodefinido de hoy</Label>
            {stats.streak > 0 && (
              <View style={{ backgroundColor: alpha('#E08A1E', 0.16), borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: theme.dark ? '#F3B45B' : '#A9610A' }}>
                  🔥 {stats.streak} {stats.streak === 1 ? 'día' : 'días'}
                </Text>
              </View>
            )}
          </View>
          <View>
            <Text style={{ fontFamily: fonts.title, fontSize: 26, color: theme.ink }}>{prettyDate(date)}</Text>
            <Body soft>
              N.º {puzzle.n} · {puzzle.words.length} palabras
              {state?.startedAt && state.finishedAt ? ` · ${formatTime((state.finishedAt - state.startedAt) / 1000)}` : ''}
            </Body>
          </View>

          <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.line, overflow: 'hidden' }}>
            <View style={{ width: `${Math.round(progress * 100)}%`, height: '100%', backgroundColor: done ? theme.good : theme.ink }} />
          </View>

          {(started || done) && d && (
            <View style={{ flexDirection: 'row', gap: space.lg }}>
              <ScoreLine name={profile.name} color={profile.color} score={d.scores[profile.uid] ?? 0} />
              {partner && <ScoreLine name={partner.name} color={partner.color} score={d.scores[partner.uid] ?? 0} />}
            </View>
          )}

          {partnerPlaying && !done && (
            <Body style={{ color: colorHex(partner!.color), fontFamily: fonts.medium }}>● {partner!.name} está jugando ahora</Body>
          )}

          <Button label={done ? 'Ver resultado' : started ? 'Continuar' : 'Jugar'} onPress={() => app.go({ name: 'game', date })} />
          {partner && !done && <Button label={poked ? 'Toque enviado' : `Dar un toque a ${partner.name}`} kind="soft" onPress={poke} disabled={poked} />}
        </Card>

        {/* emparejamiento */}
        {!profile.room && (
          <Pressable onPress={() => app.go({ name: 'pair' })}>
            <Card style={{ gap: 6, backgroundColor: theme.dark ? '#26313B' : '#FFF4D6', borderColor: theme.dark ? theme.line : '#EBD9A4' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: theme.ink }}>Invita a tu pareja de juego  ›</Text>
              <Body soft>
                {firebaseEnabled
                  ? 'Crea una sala y envía la invitación para resolverlo a la vez desde los dos móviles.'
                  : 'Ahora mismo juegas solo en este móvil. Falta conectar la base de datos para jugar a dos.'}
              </Body>
            </Card>
          </Pressable>
        )}
        {profile.room && !partner && (
          <Pressable onPress={() => app.go({ name: 'pair' })}>
            <Card style={{ gap: 6 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: theme.ink }}>Esperando a la otra persona  ›</Text>
              <Body soft>Tu sala es {profile.room}. Toca para reenviar la invitación.</Body>
            </Card>
          </Pressable>
        )}

        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Tile icon="🗓" title="Archivo" sub="Días anteriores" onPress={() => app.go({ name: 'archive' })} />
          <Tile icon="📊" title="Marcador" sub={`${stats.played} completados`} onPress={() => app.go({ name: 'stats' })} />
          <Tile icon="⚙️" title="Ajustes" sub="Avisos y perfil" onPress={() => app.go({ name: 'settings' })} />
        </View>
      </ScrollView>
    </View>
  );
}

function ScoreLine({ name, color, score }: { name: string; color: string; score: number }) {
  const { theme } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colorHex(color) }} />
      <Text style={{ fontFamily: fonts.body, fontSize: 14, color: theme.inkSoft }}>{name}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: theme.ink }}>{score}</Text>
    </View>
  );
}

function Tile({ icon, title, sub, onPress }: { icon: string; title: string; sub: string; onPress: () => void }) {
  const { theme } = useApp();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: theme.card,
        borderRadius: radius.md,
        padding: space.md,
        gap: 4,
        borderWidth: 1,
        borderColor: theme.line,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: theme.ink }}>{title}</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: theme.inkFaint }} numberOfLines={1}>
        {sub}
      </Text>
    </Pressable>
  );
}
