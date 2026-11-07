package al.traininghub.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.os.Build;

/**
 * Përgjigja e PackageInstaller-it për përditësimin brenda app-it. Kur sistemi kërkon konfirmim,
 * hapet dritarja e tij; një dështim ose anulim i kalon app-it (AppUpdaterPlugin.report). Suksesi
 * nuk raportohet: Android-i e mbyll app-in për ta zëvendësuar.
 */
public class AppUpdateReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                ? intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class)
                : intent.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirm != null) {
                confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(confirm);
            }
            AppUpdaterPlugin.report("pending_user", false, message);
        } else if (status != PackageInstaller.STATUS_SUCCESS) {
            AppUpdaterPlugin.report("failure", status == PackageInstaller.STATUS_FAILURE_ABORTED, message);
        }
    }
}
