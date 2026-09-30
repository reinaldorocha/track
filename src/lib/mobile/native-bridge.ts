import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { Haptics, NotificationType } from "@capacitor/haptics";
import { playNotificationSound, SoundType } from "@/lib/sound";

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function getPlatformName(): "android" | "ios" | "web" {
  const plat = Capacitor.getPlatform();
  if (plat === "android") return "android";
  if (plat === "ios") return "ios";
  return "web";
}

export async function triggerHaptic(type: "success" | "warning" | "error" = "success") {
  if (!isNativePlatform()) return;
  try {
    const hapticMap = {
      success: NotificationType.Success,
      warning: NotificationType.Warning,
      error: NotificationType.Error,
    };
    await Haptics.notification({ type: hapticMap[type] });
  } catch (err) {
    console.warn("Haptics failed:", err);
  }
}

export async function initializeNativePush(onTokenReceived?: (token: string) => void) {
  if (!isNativePlatform()) return;

  try {
    // 1. Solicita permissão nativa
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt") {
      perm = await PushNotifications.requestPermissions();
    }

    if (perm.receive !== "granted") {
      console.warn("Push notification permission not granted:", perm.receive);
      return;
    }

    // 2. Registra o dispositivo no APNs / FCM
    await PushNotifications.register();

    // 3. Listener para quando o token for gerado
    PushNotifications.addListener("registration", async (token) => {
      console.log("Push registration token:", token.value);
      if (onTokenReceived) onTokenReceived(token.value);

      // Registra no backend UTM-Track
      try {
        await fetch("/api/devices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: token.value,
            platform: getPlatformName(),
            deviceName: `${getPlatformName().toUpperCase()} Device`,
          }),
        });
      } catch (e) {
        console.error("Failed to register device on UTM-Track backend:", e);
      }
    });

    // 4. Listener para erros de registro
    PushNotifications.addListener("registrationError", (err) => {
      console.error("Push registration error:", err.error);
    });

    // 5. Listener para notificação recebida com app aberto
    PushNotifications.addListener("pushNotificationReceived", async (notification) => {
      console.log("Push received in foreground:", notification);
      const sound = (notification.data?.sound || "som_venda_aprovada") as SoundType;
      await playNotificationSound(sound);
      await triggerHaptic(sound === "som_venda_aprovada" ? "success" : "warning");
    });

    // 6. Listener para toque na notificação (abertura com deep link direto para a venda)
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      console.log("Push action performed:", action);
      const data = action.notification.data;
      if (data?.saleId) {
        window.location.href = `/sales/${data.saleId}`;
      } else if (data?.deepLink) {
        window.location.href = data.deepLink;
      } else {
        window.location.href = `/notifications`;
      }
    });
  } catch (err) {
    console.error("Error initializing native push notifications:", err);
  }
}
