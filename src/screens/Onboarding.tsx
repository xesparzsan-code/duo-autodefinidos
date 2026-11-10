import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PLAYER_COLORS, fonts, radius, space, useTheme } from '../theme';
import { newProfile, type Profile } from '../storage';

export function ColorPicker({ value, onChange, taken }: { value: string; onChange: (id: string) => void; taken?: string }) {
  const theme = useTheme('light');
  return (
    <View style={{ flexDirection: 'row', gap: space.md, flexWrap: 'wrap' }}>
      {PLAYER_COLORS.map((c) => {
        const disabled = taken === c.id;
        return (
          <Pressable
            key={c.id}
            disabled={disabled}
            onPress={() => onChange(c.id)}
            accessibilityLabel={`Color ${c.name}`}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: c.hex,
              opacity: disabled ? 0.2 : 1,
              borderWidth: value === c.id ? 3 : 0,
              borderColor: theme.ink,
            }}
          />
        );
      })}
    </View>
  );
}

export function Onboarding({ onDone }: { onDone: (p: Profile) => void }) {
  const theme = useTheme('light');
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(PLAYER_COLORS[0].id);
  const ok = name.trim().length >= 2;
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl, paddingHorizontal: space.xl }}
    >
      <View style={{ flex: 1, justifyContent: 'center', gap: space.xl, maxWidth: 440, width: '100%', alignSelf: 'center' }}>
        <View style={{ gap: space.sm }}>
          <Text style={{ fontFamily: fonts.titleBold, fontSize: 72, lineHeight: 76, color: theme.ink, letterSpacing: -4 }}>Dúo</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 17, lineHeight: 24, color: theme.inkSoft }}>
            Un autodefinido nuevo cada día, para resolverlo entre dos.
          </Text>
        </View>

        <View style={{ gap: space.sm }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: theme.ink }}>¿Cómo te llamas?</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Tu nombre"
            placeholderTextColor={theme.inkFaint}
            maxLength={14}
            autoCapitalize="words"
            autoCorrect={false}
            style={{
              fontFamily: fonts.hand,
              fontSize: 26,
              color: theme.ink,
              backgroundColor: theme.card,
              borderRadius: radius.md,
              paddingHorizontal: space.lg,
              paddingVertical: 14,
              borderWidth: 1.5,
              borderColor: theme.ink,
            }}
          />
        </View>

        <View style={{ gap: space.md }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: theme.ink }}>Elige el color de tu boli</Text>
          <ColorPicker value={color} onChange={setColor} />
        </View>

        <Pressable
          disabled={!ok}
          onPress={() => onDone(newProfile(name.trim(), color))}
          style={({ pressed }) => ({
            backgroundColor: theme.accent,
            borderRadius: 4,
            paddingVertical: 16,
            alignItems: 'center',
            opacity: !ok ? 0.35 : pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ fontFamily: fonts.titleBold, fontSize: 19, color: theme.onAccent, letterSpacing: -0.5 }}>Empezar</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
