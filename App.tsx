import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, AppState, BackHandler, Platform, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ExpoLinking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne';
import { BarlowSemiCondensed_400Regular, BarlowSemiCondensed_500Medium, BarlowSemiCondensed_600SemiBold } from '@expo-google-fonts/barlow-semi-condensed';
import { PatrickHand_400Regular } from '@expo-google-fonts/patrick-hand';

import { loadProfile, saveProfile, type Profile } from './src/storage';
import { PLAYER_COLORS, colorHex, fonts, useTheme } from './src/theme';
import { Ctx, type AppContext, type Screen } from './src/ui';
import {
  clearPresence,
  joinRoom,
  onConnection,
  setPresence,
  subscribePlayers,
  subscribePresence,
  subscribeResults,
  subscribeSignals,
  updatePlayer,
  type Player,
  type Presence,
} from './src/sync';
import type { DayResult } from './src/logic';
import { scheduleDailyReminder } from './src/notify';
import { loadRemoteCache } from './src/puzzles';
import { Onboarding } from './src/screens/Onboarding';
import { HomeScreen } from './src/screens/Home';
import { GameScreen } from './src/screens/Game';
import { PairScreen } from './src/screens/Pair';
import { ArchiveScreen, SettingsScreen, StatsScreen } from './src/screens/More';

function Root() {
  const [fontsLoaded] = useFonts({
    Syne_700Bold,
    Syne_800ExtraBold,
    BarlowSemiCondensed_400Regular,
    BarlowSemiCondensed_500Medium,
    BarlowSemiCondensed_600SemiBold,
    PatrickHand_400Regular,
  });
  const [profile, setProfileState] = useState<Profile | null | undefined>(undefined);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [presence, setPresenceMap] = useState<Record<string, Presence>>({});
  const [results, setResults] = useState<Record<string, DayResult>>({});
  const [online, setOnline] = useState(false);
  const [, setWake] = useState(0);
  const [toastText, setToastText] = useState<string | null>(null);
  const [bigEmoji, setBigEmoji] = useState<{ text: string; color: string } | null>(null);
  const emojiAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const theme = useTheme(profile?.theme ?? 'light');
  const insets = useSafeAreaInsets();
  const url = ExpoLinking.useURL();

  useEffect(() => {
    loadRemoteCache()
      .catch(() => {})
      .then(() => loadProfile())
      .then((p) => setProfileState(p));
  }, []);

  const setProfile = useCallback((p: Profile) => {
    setProfileState(p);
    saveProfile(p);
  }, []);

  const toast = useCallback((text: string) => {
    setToastText(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastText(null), 2600);
  }, []);

  const room = profile?.room ?? null;
  const uid = profile?.uid ?? null;

  // aviso diario
  useEffect(() => {
    if (profile) scheduleDailyReminder(profile.reminderHour);
  }, [profile?.reminderHour, uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // conexión
  useEffect(() => onConnection(setOnline), []);

  // sala: jugadores, presencia, resultados y señales
  const playersRef = useRef(players);
  playersRef.current = players;
  useEffect(() => {
    if (!uid) return;
    const offResults = subscribeResults(room, setResults);
    if (!room) {
      setPlayers({});
      setPresenceMap({});
      return offResults;
    }
    const offPlayers = subscribePlayers(room, setPlayers);
    const offPresence = subscribePresence(room, setPresenceMap);
    const offSignals = subscribeSignals(room, uid, (s) => {
      const who = playersRef.current[s.by]?.name ?? 'Tu pareja';
      if (s.kind === 'poke') toast(`${who} te da un toque`);
      else if (s.emoji) {
        setBigEmoji({ text: s.emoji, color: colorHex(playersRef.current[s.by]?.color) });
        emojiAnim.setValue(0);
        Animated.sequence([
          Animated.spring(emojiAnim, { toValue: 1, useNativeDriver: true, friction: 5 }),
          Animated.delay(900),
          Animated.timing(emojiAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start(() => setBigEmoji(null));
      }
    });
    setPresence(room, uid, {});
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') setPresence(room, uid, {});
      else clearPresence(room, uid);
    });
    return () => {
      offResults();
      offPlayers();
      offPresence();
      offSignals();
      sub.remove();
      clearPresence(room, uid);
    };
  }, [room, uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // al volver a la app se repinta todo: si ha cambiado el día, aparece el autodefinido nuevo
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') setWake((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  // si los dos eligieron el mismo color de boli, uno de ellos cambia solo (el de uid mayor)
  useEffect(() => {
    if (!profile) return;
    const other = Object.values(players).find((p) => p.uid !== profile.uid);
    if (other && other.color === profile.color && profile.uid > other.uid) {
      const free = PLAYER_COLORS.find((c) => c.id !== other.color);
      if (free) {
        const p = { ...profile, color: free.id };
        setProfile(p);
        updatePlayer(p);
        toast(`Teníais el mismo color: ahora tu boli es ${free.name.toLowerCase()}`);
      }
    }
  }, [players, profile?.color]); // eslint-disable-line react-hooks/exhaustive-deps

  // enlace de invitación: duoautodef://unir/CODIGO
  useEffect(() => {
    if (!url || !profile) return;
    const m = url.match(/unir\/([A-Za-z0-9]{6,12})/);
    if (!m) return;
    const code = m[1].toUpperCase();
    if (profile.room === code) return;
    joinRoom(code, profile).then((res) => {
      if (res === 'ok') {
        setProfile({ ...profile, room: code });
        toast('¡Invitación aceptada! Ya compartís sala.');
      } else if (res === 'full') toast('Esa sala ya tiene dos jugadores.');
      else toast('No se pudo abrir la invitación.');
    });
  }, [url, uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // botón atrás de Android
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen.name !== 'home') {
        setScreen({ name: 'home' });
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [screen.name]);

  const resetAll = useCallback(() => {
    const run = async () => {
      if (profile) clearPresence(profile.room, profile.uid);
      await AsyncStorage.clear();
      setProfileState(null);
      setScreen({ name: 'home' });
    };
    if (Platform.OS === 'web') {
      if (window.confirm('¿Borrar tu perfil y las partidas guardadas en este dispositivo?')) run();
    } else {
      Alert.alert('Borrar mis datos', 'Se borrará tu perfil y las partidas guardadas en este móvil.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar', style: 'destructive', onPress: run },
      ]);
    }
  }, [profile]);

  const ctx: AppContext | null = useMemo(() => {
    if (!profile) return null;
    const partner = Object.values(players).find((p) => p.uid !== profile.uid) ?? null;
    return { profile, setProfile, theme, players, partner, presence, results, online, go: setScreen, toast, resetAll };
  }, [profile, setProfile, theme, players, presence, results, online, toast, resetAll]);

  if (!fontsLoaded || profile === undefined) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

  if (!profile || !ctx) {
    return (
      <>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
        <Onboarding onDone={setProfile} />
      </>
    );
  }

  return (
    <Ctx.Provider value={ctx}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      {screen.name === 'home' && <HomeScreen />}
      {screen.name === 'game' && <GameScreen key={screen.date} date={screen.date} />}
      {screen.name === 'pair' && <PairScreen />}
      {screen.name === 'archive' && <ArchiveScreen />}
      {screen.name === 'stats' && <StatsScreen />}
      {screen.name === 'settings' && <SettingsScreen />}

      {bigEmoji && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '30%',
            alignItems: 'center',
            opacity: emojiAnim,
            transform: [{ scale: emojiAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }, { rotate: '-7deg' }],
          }}
        >
          <Text style={{ fontFamily: fonts.hand, fontSize: 76, color: bigEmoji.color }}>{bigEmoji.text}</Text>
        </Animated.View>
      )}

      {toastText && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, top: insets.top + 56, alignItems: 'center' }}>
          <View style={{ backgroundColor: theme.ink, borderRadius: 4, paddingHorizontal: 16, paddingVertical: 10, maxWidth: 420 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: theme.bg, textAlign: 'center' }}>{toastText}</Text>
          </View>
        </View>
      )}
    </Ctx.Provider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}
