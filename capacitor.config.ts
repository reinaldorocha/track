import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.utmtrack.app",
  appName: "UTM-Track",
  webDir: "public",
  server: {
    androidScheme: "https",
    cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    LocalNotifications: {
      smallIcon: "ic_stat_utmtrack",
      iconColor: "#0066FF",
      sound: "som_venda_aprovada.wav",
    },
  },
};

export default config;
