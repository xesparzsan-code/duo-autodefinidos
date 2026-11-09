/**
 * Avisos.
 *
 * - Entre jugadores: por ntfy (https://ntfy.sh). Cada móvil se suscribe a su tema
 *   privado en la app ntfy y el otro publica ahí. Así llegan también con la app
 *   cerrada, y en el iPhone instalado con AltStore (que no admite push propio).
 * - Aviso diario del autodefinido nuevo: notificación local programada.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { NTFY_SERVER, APP_SCHEME } from './config';

export async function ntfy(topic: string | undefined, title: string, message: string, tags: string[] = []): Promise<boolean> {
  if (!topic) return false;
  try {
    const res = await fetch(NTFY_SERVER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, title, message, tags, click: `${APP_SCHEME}://` }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const ntfySubscribeLink = (topic: string) => `ntfy://${NTFY_SERVER.replace(/^https?:\/\//, '')}/${topic}`;
export const ntfyWebLink = (topic: string) => `${NTFY_SERVER}/${topic}`;

const native = Platform.OS !== 'web';

if (native) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Programa (o cancela) el aviso diario. Devuelve false si no hay permiso. */
export async function scheduleDailyReminder(hour: number | null): Promise<boolean> {
  if (!native) return true;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (hour === null) return true;
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return false;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('diario', {
        name: 'Autodefinido diario',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Autodefinido de hoy',
        body: 'Ya tenéis uno nuevo esperando. ¿Quién acierta más?',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute: 0,
        channelId: 'diario',
      },
    });
    return true;
  } catch {
    return false;
  }
}
