package al.traininghub.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Alarmet dhe butonat e rikujtuesve (V37, V2-E2-08; ReminderNotifier) dhe rinisja pas ndezjes së
 * telefonit ose përditësimit, kur Android-i i heq alarmet. PendingIntent-et janë të qarta, ndaj
 * punojnë me ekran të kyçur dhe kur procesi është vrarë.
 */
public class ReminderReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;
        int id = intent.getIntExtra(ReminderNotifier.EXTRA_ID, -1);
        switch (action) {
            case ReminderNotifier.ACTION_FIRE:
                if (id >= 0) ReminderNotifier.fire(context, id);
                break;
            case ReminderNotifier.ACTION_BUTTON: {
                String button = intent.getStringExtra(ReminderNotifier.EXTRA_ACTION);
                if (id >= 0 && button != null) ReminderNotifier.onButton(context, id, button);
                break;
            }
            case ReminderNotifier.ACTION_UNDO: {
                String target = intent.getStringExtra(ReminderNotifier.EXTRA_TARGET);
                if (id >= 0 && target != null) ReminderNotifier.onUndo(context, id, target);
                break;
            }
            case Intent.ACTION_BOOT_COMPLETED:
            case Intent.ACTION_MY_PACKAGE_REPLACED:
                ReminderNotifier.restore(context);
                break;
            default:
                break;
        }
    }
}
