import React, { createContext, useContext } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { fonts, radius, space, type Theme, colorHex } from './theme';
import type { Profile } from './storage';
import type { Player, Presence } from './sync';
import type { DayResult } from './logic';

export type Screen =
  | { name: 'home' }
  | { name: 'game'; date: string }
  | { name: 'archive' }
  | { name: 'stats' }
  | { name: 'settings' }
  | { name: 'pair' };

export interface AppContext {
  profile: Profile;
  setProfile: (p: Profile) => void;
  theme: Theme;
  players: Record<string, Player>;
  partner: Player | null;
  presence: Record<string, Presence>;
  results: Record<string, DayResult>;
  online: boolean;
  go: (s: Screen) => void;
  toast: (text: string) => void;
  resetAll: () => void;
}

export const Ctx = createContext<AppContext>(null as unknown as AppContext);
export const useApp = () => useContext(Ctx);

export function tap(enabled = true) {
  if (enabled && Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
}

export function Title({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { theme } = useApp();
  return <Text style={[{ fontFamily: fonts.title, fontSize: 28, color: theme.ink, letterSpacing: -1 }, style]}>{children}</Text>;
}

export function Body({ children, style, soft }: { children: React.ReactNode; style?: StyleProp<TextStyle>; soft?: boolean }) {
  const { theme } = useApp();
  return <Text style={[{ fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: soft ? theme.inkSoft : theme.ink }, style]}>{children}</Text>;
}

export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { theme } = useApp();
  return <Text style={[{ fontFamily: fonts.bold, fontSize: 15, color: theme.inkSoft }, style]}>{children}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { theme } = useApp();
  return (
    <View
      style={[
        { backgroundColor: theme.card, borderRadius: radius.lg, padding: space.lg, borderWidth: 1.5, borderColor: theme.ink },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  style,
  small,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost' | 'soft';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const { theme, profile } = useApp();
  const bg = kind === 'primary' ? theme.accent : kind === 'soft' ? theme.card : 'transparent';
  const fg = kind === 'primary' ? theme.onAccent : theme.ink;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        tap(profile?.haptics);
        onPress();
      }}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radius.sm,
          paddingVertical: small ? 9 : 14,
          paddingHorizontal: small ? 14 : 22,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
          borderWidth: kind === 'primary' ? 0 : 1.5,
          borderColor: theme.ink,
        },
        style,
      ]}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: small ? 15 : 18, color: fg }}>{label}</Text>
    </Pressable>
  );
}

export function Avatar({ name, color, size = 36, ring }: { name: string; color: string; size?: number; ring?: boolean }) {
  const { theme } = useApp();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colorHex(color),
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: ring ? 2 : 0,
        borderColor: theme.good,
      }}
    >
      <Text style={{ fontFamily: fonts.hand, color: '#fff', fontSize: size * 0.56, lineHeight: size * 0.7 }}>{(name.trim()[0] ?? '?').toUpperCase()}</Text>
    </View>
  );
}

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  const { theme } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.md }}>
      {onBack && (
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Volver">
          <Text style={{ fontFamily: fonts.medium, fontSize: 26, color: theme.ink, marginTop: -3 }}>‹</Text>
        </Pressable>
      )}
      <Text style={{ flex: 1, fontFamily: fonts.title, fontSize: 26, color: theme.ink, letterSpacing: -1 }} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}
