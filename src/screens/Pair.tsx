import React, { useState } from 'react';
import { ScrollView, Share, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { APP_SCHEME, firebaseEnabled } from '../config';
import { createRoom, joinRoom, leaveRoom } from '../sync';
import { fonts, radius, space } from '../theme';
import { Avatar, Body, Button, Card, Header, Label, useApp } from '../ui';

export function inviteText(name: string, code: string) {
  return `${name} te invita a resolver juntos el autodefinido diario en Dúo.\n\nCódigo de sala: ${code}\n\nSi ya tienes la app, abre este enlace: ${APP_SCHEME}://unir/${code}`;
}

export function PairScreen() {
  const app = useApp();
  const { theme, profile, partner } = app;
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const room = await createRoom(profile);
      app.setProfile({ ...profile, room });
    } catch {
      app.toast('No se pudo crear la sala. Revisa la conexión.');
    }
    setBusy(false);
  };

  const join = async () => {
    setBusy(true);
    const res = await joinRoom(code, profile);
    setBusy(false);
    if (res === 'ok') {
      app.setProfile({ ...profile, room: code.trim().toUpperCase() });
      app.toast('¡Dentro! Ya compartís sala.');
      app.go({ name: 'home' });
    } else if (res === 'full') app.toast('Esa sala ya tiene dos jugadores.');
    else if (res === 'notfound') app.toast('No existe ninguna sala con ese código.');
    else app.toast('No se pudo conectar. Inténtalo de nuevo.');
  };

  const leave = async () => {
    await leaveRoom(profile);
    app.setProfile({ ...profile, room: null });
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
      <Header title="Jugar en pareja" onBack={() => app.go({ name: 'home' })} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: insets.bottom + space.xl, maxWidth: 520, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        {!firebaseEnabled ? (
          <Card>
            <Body>
              Falta conectar la base de datos. Rellena los datos de Firebase en <Text style={{ fontFamily: fonts.bold }}>src/config.ts</Text> y vuelve a
              compilar la app. Mientras tanto puedes jugar en este móvil.
            </Body>
          </Card>
        ) : profile.room ? (
          <>
            <Card style={{ alignItems: 'center', gap: space.md }}>
              <Label>Código de vuestra sala</Label>
              <Text selectable style={{ fontFamily: fonts.titleBold, fontSize: 36, letterSpacing: 4, color: theme.ink }}>
                {profile.room}
              </Text>
              {partner ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <Avatar name={partner.name} color={partner.color} size={28} />
                  <Body>Compartes sala con {partner.name}</Body>
                </View>
              ) : (
                <Body soft style={{ textAlign: 'center' }}>
                  Envía la invitación a la otra persona. En cuanto introduzca el código, quedaréis emparejados.
                </Body>
              )}
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button label="Enviar invitación" onPress={() => Share.share({ message: inviteText(profile.name, profile.room!) }).catch(() => {})} />
                <Button
                  label="Copiar"
                  kind="soft"
                  onPress={async () => {
                    await Clipboard.setStringAsync(profile.room!);
                    app.toast('Código copiado');
                  }}
                />
              </View>
            </Card>
            <Button label="Salir de esta sala" kind="ghost" onPress={leave} />
          </>
        ) : (
          <>
            <Card style={{ gap: space.md }}>
              <Label>Crear una sala</Label>
              <Body soft>Crea la sala y envía la invitación a la otra persona.</Body>
              <Button label="Crear sala e invitar" onPress={create} disabled={busy} />
            </Card>
            <Card style={{ gap: space.md }}>
              <Label>Tengo una invitación</Label>
              <TextInput
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="CÓDIGO"
                placeholderTextColor={theme.inkFaint}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
                style={{
                  fontFamily: fonts.bold,
                  fontSize: 24,
                  letterSpacing: 4,
                  textAlign: 'center',
                  color: theme.ink,
                  backgroundColor: theme.bg,
                  borderRadius: radius.md,
                  paddingVertical: 12,
                  borderWidth: 1,
                  borderColor: theme.line,
                }}
              />
              <Button label="Unirme" onPress={join} disabled={busy || code.length < 6} />
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
