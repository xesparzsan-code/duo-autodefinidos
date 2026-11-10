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
    const s = new GameSession(profile.room, date, profile.uid, true);
    const off = s.subscribe(setState);
    return () => {
      off();
      s.close();
    };
  }, [profile.room, profile.uid, date]);

  const d = useMemo(() => (state ? derive(puzzle, state.cells, state.hints) : null), [state, puzzle]);
  const stats = useMemo(() => computeStats(app.results, date, (x) => addDays(x, -1)), [app.results, date]);
  const progress = d ? d.filled / puzzle.whiteCount : 0;
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
        <View style={{ backgroundColor: theme.accent, borderRadius: radius.lg, padding: space.xl, gap: space.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.2, color: alpha('#FFFFFF', 0.75) }}>AUTODEFINIDO DE HOY</Text>
            {stats.streak > 0 && (
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#C2410C' }}>
                  🔥 {stats.streak} {stats.streak === 1 ? 'día' : 'días'}
                </Text>
              </View>
            )}
          </View>
          <View>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.title, fontSize: 25, color: '#FFFFFF' }}>
              {prettyDate(date)}
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 15, color: alpha('#FFFFFF', 0.8) }}>
              N.º {puzzle.n} · {puzzle.words.length} palabras
              {state?.startedAt && state.finishedAt ? ` · ${formatTime((state.finishedAt - state.startedAt) / 1000)}` : ''}
            </Text>
          </View>

          <View style={{ height: 10, borderRadius: 5, backgroundColor: alpha('#FFFFFF', 0.25), overflow: 'hidden' }}>
            <View style={{ width: `${Math.round(progress * 100)}%`, height: '100%', backgroundColor: done ? '#86EFAC' : '#FFFFFF' }} />
          </View>

          {(started || done) && d && (
            <View style={{ flexDirection: 'row', gap: space.lg }}>
              <ScoreLine name={profile.name} color={profile.color} score={(done ? d.scores : d.placed)[profile.uid] ?? 0} unit={done ? 'puntos' : 'letras'} />
              {partner && (
                <ScoreLine name={partner.name} color={partner.color} score={(done ? d.scores : d.placed)[partner.uid] ?? 0} unit={done ? 'puntos' : 'letras'} />
              )}
            </View>
          )}

          {partnerPlaying && !done && (
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: '#FFFFFF' }}>● {partner!.name} está jugando ahora</Text>
          )}

          <Pressable
            onPress={() => app.go({ name: 'game', date })}
            accessibilityRole="button"
            style={({ pressed }) => ({ backgroundColor: '#FFFFFF', borderRadius: 999, paddingVertical: 15, alignItems: 'center', opacity: pressed ? 0.85 : 1 })}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: theme.dark ? '#4F46E5' : theme.accent }}>
              {done ? 'Ver resultado' : started ? 'Continuar' : 'Jugar'}
            </Text>
          </Pressable>
          {partner && !done && (
            <Pressable
              onPress={poke}
              disabled={poked}
              accessibilityRole="button"
              style={({ pressed }) => ({ borderRadius: 999, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: alpha('#FFFFFF', 0.6), opacity: poked ? 0.5 : pressed ? 0.7 : 1 })}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#FFFFFF' }}>{poked ? 'Toque enviado' : `👋 Dar un toque a ${partner.name}`}</Text>
            </Pressable>
          )}
        </View>

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
          <Tile icon="🗓️" color="#F59E0B" title="Archivo" sub="Días anteriores" onPress={() => app.go({ name: 'archive' })} />
          <Tile icon="🏆" color="#10B981" title="Marcador" sub={`${stats.played} completados`} onPress={() => app.go({ name: 'stats' })} />
        </View>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Tile icon="🤝" color="#EC4899" title="Pareja" sub={partner ? `Con ${partner.name}` : 'Invitar'} onPress={() => app.go({ name: 'pair' })} />
          <Tile icon="⚙️" color="#6366F1" title="Ajustes" sub="Avisos y perfil" onPress={() => app.go({ name: 'settings' })} />
        </View>
      </ScrollView>
    </View>
  );
}

function ScoreLine({ name, color, score, unit }: { name: string; color: string; score: number; unit: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colorHex(color), borderWidth: 1.5, borderColor: '#FFFFFF' }} />
      <Text style={{ fontFamily: fonts.body, fontSize: 14, color: alpha('#FFFFFF', 0.85) }}>{name}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#FFFFFF' }}>{score}</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 12, color: alpha('#FFFFFF', 0.7), marginLeft: -3 }}>{unit}</Text>
    </View>
  );
}

function Tile({ icon, color, title, sub, onPress }: { icon: string; color: string; title: string; sub: string; onPress: () => void }) {
  const { theme } = useApp();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: alpha(color, theme.dark ? 0.22 : 0.14),
        borderRadius: radius.lg,
        padding: space.lg,
        gap: 8,
        borderWidth: 1.5,
        borderColor: alpha(color, 0.35),
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 34 }}>{icon}</Text>
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: theme.ink }}>{title}</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 13, color: theme.inkSoft }} numberOfLines={1}>
        {sub}
      </Text>
    </Pressable>
  );
}
