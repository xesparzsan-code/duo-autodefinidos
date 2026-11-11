import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { computeStats, derive, formatTime } from '../logic';
import { addDays, availableDates, gamePuzzle, prettyDate, puzzleNumber, today } from '../puzzles';
import { cachedProgress, updatePlayer } from '../sync';
import { ntfy, ntfySubscribeLink, scheduleDailyReminder } from '../notify';
import { colorHex, fonts, radius, space } from '../theme';
import { Avatar, Body, Button, Card, Header, Label, useApp } from '../ui';
import { ColorPicker } from './Onboarding';

// ------------------------------------------------------------ archivo

export function ArchiveScreen() {
  const app = useApp();
  const { theme, profile } = app;
  const insets = useSafeAreaInsets();
  const dates = useMemo(() => availableDates(90), []);
  const [progress, setProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      const res: Record<string, number> = {};
      for (const d of dates) {
        if (app.results[d]) continue;
        const c = await cachedProgress(profile.room, d);
        if (c && Object.keys(c.cells).length) {
          const p = gamePuzzle(d, c.puzzle);
          res[d] = derive(p, c.cells).filled / p.whiteCount;
        }
      }
      if (alive) setProgress(res);
    })();
    return () => {
      alive = false;
    };
  }, [dates, profile.room, app.results]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
      <Header title="Archivo" onBack={() => app.go({ name: 'home' })} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.sm, paddingBottom: insets.bottom + space.xl, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
        {dates.map((d) => {
          const r = app.results[d];
          const pr = progress[d];
          return (
            <Pressable
              key={d}
              onPress={() => app.go({ name: 'game', date: d })}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                backgroundColor: theme.card,
                borderRadius: radius.md,
                padding: space.md,
                borderWidth: 1,
                borderColor: theme.line,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: theme.clueCell, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.title, fontSize: 15, color: theme.ink }}>{puzzleNumber(d)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: theme.ink }}>
                  {d === today() ? 'Hoy' : prettyDate(d)}
                </Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: r ? theme.good : theme.inkFaint }}>
                  {r ? `Completado en ${formatTime(r.secs)}` : pr !== undefined ? `A medias, ${Math.round(pr * 100)} %` : 'Sin empezar'}
                </Text>
              </View>
              {r && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {Object.entries(r.scores ?? {}).map(([uid, sc]) => (
                    <Text key={uid} style={{ fontFamily: fonts.bold, fontSize: 15, color: colorHex(uid === profile.uid ? profile.color : app.players[uid]?.color) }}>
                      {sc}
                    </Text>
                  ))}
                </View>
              )}
              
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ------------------------------------------------------------ estadísticas

export function StatsScreen() {
  const app = useApp();
  const { theme, profile, partner } = app;
  const insets = useSafeAreaInsets();
  const st = useMemo(() => computeStats(app.results, today(), (x) => addDays(x, -1)), [app.results]);
  const people = [{ uid: profile.uid, name: profile.name, color: profile.color }, ...(partner ? [partner] : [])];
  const recent = Object.keys(app.results).sort().reverse().slice(0, 14);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
      <Header title="Marcador" onBack={() => app.go({ name: 'home' })} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: insets.bottom + space.xl, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Stat big={`${st.streak}`} label="Racha actual" color={theme.tomato} />
          <Stat big={`${st.bestStreak}`} label="Mejor racha" color={theme.mint} />
          <Stat big={st.bestSecs !== null ? formatTime(st.bestSecs) : '—'} label="Mejor tiempo" color={theme.cobalt} />
        </View>

        <Card style={{ gap: space.lg }}>
          <Label>Cara a cara en {st.played} completados</Label>
          {people.map((p) => {
            const wins = st.wins[p.uid] ?? 0;
            const total = Math.max(1, st.played);
            return (
              <View key={p.uid} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <Avatar name={p.name} color={p.color} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: theme.ink }}>{p.name}</Text>
                    <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: theme.inkSoft }}>{st.points[p.uid] ?? 0} puntos en total</Text>
                  </View>
                  <Text style={{ fontFamily: fonts.title, fontSize: 24, color: colorHex(p.color) }}>{wins}</Text>
                  <Text style={{ fontFamily: fonts.body, fontSize: 12, color: theme.inkFaint }}>{wins === 1 ? 'victoria' : 'victorias'}</Text>
                </View>
                {partner && (
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.line, overflow: 'hidden' }}>
                    <View style={{ width: `${(wins / total) * 100}%`, height: '100%', backgroundColor: colorHex(p.color) }} />
                  </View>
                )}
              </View>
            );
          })}
          {partner && <Body soft>Empates: {st.ties}</Body>}
        </Card>

        {recent.length > 0 && (
          <Card style={{ gap: space.md }}>
            <Label>Últimos días</Label>
            {recent.map((d) => {
              const r = app.results[d];
              return (
                <View key={d} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 14, color: theme.ink }}>{prettyDate(d, false)}</Text>
                  <Text style={{ fontFamily: fonts.body, fontSize: 13, color: theme.inkFaint, marginRight: space.md }}>{formatTime(r.secs)}</Text>
                  {people.map((p) => (
                    <Text key={p.uid} style={{ width: 44, textAlign: 'right', fontFamily: fonts.bold, fontSize: 14, color: colorHex(p.color) }}>
                      {r.scores?.[p.uid] ?? 0}
                    </Text>
                  ))}
                </View>
              );
            })}
          </Card>
        )}
        {st.played === 0 && <Body soft style={{ textAlign: 'center' }}>Cuando completéis el primer autodefinido, aquí aparecerá el marcador.</Body>}
      </ScrollView>
    </View>
  );
}

function Stat({ big, label, color }: { big: string; label: string; color: string }) {
  const { theme } = useApp();
  return (
    <View style={{ flex: 1, backgroundColor: theme.card, borderRadius: radius.md, padding: space.md, borderWidth: 1, borderColor: theme.line, gap: 2 }}>
      <View style={{ width: 22, height: 6, borderRadius: 1, backgroundColor: color }} />
      <Text style={{ fontFamily: fonts.title, fontSize: 26, color: theme.ink, letterSpacing: -1 }}>{big}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: theme.inkSoft }}>{label}</Text>
    </View>
  );
}

// ------------------------------------------------------------ ajustes

export function SettingsScreen() {
  const app = useApp();
  const { theme, profile, partner } = app;
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(profile.name);

  const save = (patch: Partial<typeof profile>) => {
    const p = { ...profile, ...patch };
    app.setProfile(p);
    if (patch.name !== undefined || patch.color !== undefined) updatePlayer(p);
  };

  const setHour = async (h: number | null) => {
    save({ reminderHour: h });
    const ok = await scheduleDailyReminder(h);
    if (!ok) app.toast('Activa las notificaciones de Dúo en los ajustes del móvil');
  };

  const openNtfy = async () => {
    try {
      await Linking.openURL(ntfySubscribeLink(profile.topic));
    } catch {
      await Clipboard.setStringAsync(profile.topic);
      app.toast('Instala la app ntfy. Tu tema se ha copiado para pegarlo allí.');
    }
  };

  const hours = [null, 8, 9, 10, 13, 18, 21] as const;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
      <Header title="Ajustes" onBack={() => app.go({ name: 'home' })} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: insets.bottom + space.xl, maxWidth: 520, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: space.md }}>
          <Label>Tu perfil</Label>
          <TextInput
            value={name}
            onChangeText={setName}
            onBlur={() => name.trim().length >= 2 && save({ name: name.trim() })}
            maxLength={14}
            autoCorrect={false}
            style={{ fontFamily: fonts.medium, fontSize: 18, color: theme.ink, backgroundColor: theme.bg, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: 10, borderWidth: 1, borderColor: theme.line }}
          />
          <ColorPicker value={profile.color} onChange={(color) => save({ color })} taken={partner?.color} />
        </Card>

        <Card style={{ gap: space.md }}>
          <Label>Aviso diario</Label>
          <Body soft>Un recordatorio en este móvil cuando sale el autodefinido del día.</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {hours.map((h) => (
              <Button key={`${h}`} small label={h === null ? 'Apagado' : `${h}:00`} kind={profile.reminderHour === h ? 'primary' : 'soft'} onPress={() => setHour(h)} />
            ))}
          </View>
        </Card>

        <Card style={{ gap: space.md }}>
          <Label>Avisos de tu pareja de juego</Label>
          <Body soft>
            Los toques e invitaciones llegan a través de la app gratuita <Text style={{ fontFamily: fonts.bold, color: theme.ink }}>ntfy</Text>, también con
            Dúo cerrado.
          </Body>
          <Body>1. Instala «ntfy» desde App Store o Google Play.</Body>
          <Body>2. Pulsa «Suscribirme» para añadir tu tema privado.</Body>
          <Body>3. Pulsa «Probar» y comprueba que te llega.</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Button small label="Suscribirme" onPress={openNtfy} />
            <Button
              small
              kind="soft"
              label="Copiar mi tema"
              onPress={async () => {
                await Clipboard.setStringAsync(profile.topic);
                app.toast('Tema copiado');
              }}
            />
            <Button
              small
              kind="soft"
              label="Probar"
              onPress={async () => {
                const ok = await ntfy(profile.topic, 'Prueba de Dúo', 'Si lees esto, los avisos funcionan.', ['white_check_mark']);
                app.toast(ok ? 'Aviso de prueba enviado' : 'No se pudo enviar. ¿Hay conexión?');
              }}
            />
          </View>
          <Text selectable style={{ fontFamily: fonts.body, fontSize: 12, color: theme.inkFaint }}>
            Tu tema: {profile.topic}
          </Text>
        </Card>

        <Card style={{ gap: space.md }}>
          <Label>Aspecto</Label>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {(['auto', 'light', 'dark'] as const).map((t) => (
              <Button key={t} small label={t === 'auto' ? 'Automático' : t === 'light' ? 'Claro' : 'Oscuro'} kind={profile.theme === t ? 'primary' : 'soft'} onPress={() => save({ theme: t })} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Body>Vibración al escribir</Body>
            <Switch value={profile.haptics} onValueChange={(haptics) => save({ haptics })} />
          </View>
        </Card>

        <Card style={{ gap: space.md }}>
          <Label>Sala</Label>
          <Body soft>{profile.room ? `Código: ${profile.room}${partner ? `, con ${partner.name}` : ''}` : 'Todavía no compartes sala.'}</Body>
          <Button small kind="soft" label={profile.room ? 'Ver invitación' : 'Jugar en pareja'} onPress={() => app.go({ name: 'pair' })} />
        </Card>

        <Button kind="ghost" label="Borrar mis datos de este móvil" onPress={app.resetAll} />
      </ScrollView>
    </View>
  );
}
