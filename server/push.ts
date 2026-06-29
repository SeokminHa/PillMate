import Expo, { ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo();

export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, any>,
): Promise<void> {
  if (!Expo.isExpoPushToken(pushToken)) return;
  try {
    await expo.sendPushNotificationsAsync([
      {
        to: pushToken,
        sound: "default",
        title,
        body,
        data: data || {},
      },
    ]);
  } catch (error) {
    console.error("Push notification failed:", error);
  }
}
