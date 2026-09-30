package com.utmtrack.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannels();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) return;

            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build();

            createChannel(manager, "utmtrack_venda_aprovada", "Vendas Aprovadas", R.raw.som_venda_aprovada, audioAttributes);
            createChannel(manager, "utmtrack_pix_gerado", "Pix Gerado", R.raw.som_pix_gerado, audioAttributes);
            createChannel(manager, "utmtrack_venda_pendente", "Vendas Pendentes", R.raw.som_venda_pendente, audioAttributes);
            createChannel(manager, "utmtrack_reembolso", "Reembolsos", R.raw.som_reembolso, audioAttributes);
            createChannel(manager, "utmtrack_chargeback", "Chargebacks Críticos", R.raw.som_chargeback, audioAttributes);
        }
    }

    private void createChannel(NotificationManager manager, String channelId, String name, int soundRawId, AudioAttributes audioAttributes) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId, name, NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Alertas sonoros oficiais UTM-Track");
            channel.enableVibration(true);
            Uri soundUri = Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + getPackageName() + "/" + soundRawId);
            channel.setSound(soundUri, audioAttributes);
            manager.createNotificationChannel(channel);
        }
    }
}
