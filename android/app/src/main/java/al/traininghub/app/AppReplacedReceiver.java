package al.traininghub.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

/**
 * Pas përditësimit (brenda app-it ose me dorë), Android-i e mbyll app-in dhe nuk e rihap. Ky
 * njoftim thotë versionin e ri dhe e hap app-in me një prekje (SPEC §3b, TH-23).
 */
public class AppReplacedReceiver extends BroadcastReceiver {

    private static final String CHANNEL = "perditesimi";
    private static final int ID = 4301;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction())) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Përditësimi i app-it", NotificationManager.IMPORTANCE_DEFAULT));
        String version;
        try {
            version = context.getPackageManager().getPackageInfo(context.getPackageName(), 0).versionName;
        } catch (PackageManager.NameNotFoundException e) {
            version = "";
        }
        Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (open == null) return;
        PendingIntent content = PendingIntent.getActivity(context, ID, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        NotificationManagerCompat.from(context).notify(
            ID,
            new NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_pushimi)
                .setContentTitle("Training Hub u përditësua")
                .setContentText("Versioni " + version + ". Prek për ta hapur.")
                .setContentIntent(content)
                .setAutoCancel(true)
                .build()
        );
    }
}
