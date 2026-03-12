import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

export async function notifyUser(title: string, body: string) {
  try {
    let granted = await isPermissionGranted();

    if (!granted) {
      const permission = await requestPermission();
      granted = permission === "granted";
    }

    if (granted) {
      sendNotification({ title, body });
    }
  } catch (error) {
    console.error("Notification error:", error);
  }
}