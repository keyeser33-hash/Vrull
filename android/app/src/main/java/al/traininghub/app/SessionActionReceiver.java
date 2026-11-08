package al.traininghub.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Prekjet te njoftimi i seancës ("Ruaj setin", −/+, "Kapërce pushimin", heqja, kontrollet e muzikës)
 * dhe alarmi i pushimit (V2-E1-08, V2-E1-16a). PendingIntent-et janë të qarta (explicit), ndaj Android-i e nis procesin për
 * to edhe kur është vrarë, dhe punojnë me ekran të kyçur pa e shkyçur telefonin.
 */
public class SessionActionReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;
        String key = intent.getStringExtra(SessionNotifier.EXTRA_KEY);
        // Procesi mund të ketë nisur nga kjo prekje, pa WebView: rreshti i muzikës regjistrohet këtu.
        SessionMusic.install();
        switch (action) {
            case SessionNotifier.ACTION_SAVE:
                if (key != null) SessionNotifier.onSave(context, key);
                break;
            case SessionNotifier.ACTION_LOWER:
                if (key != null) SessionNotifier.onAdjust(context, key, -1);
                break;
            case SessionNotifier.ACTION_RAISE:
                if (key != null) SessionNotifier.onAdjust(context, key, 1);
                break;
            case SessionNotifier.ACTION_SKIP_REST:
                SessionNotifier.onSkipRest(context);
                break;
            case SessionNotifier.ACTION_REST_DONE:
                SessionNotifier.restDone(context);
                break;
            case SessionNotifier.ACTION_DISMISSED:
                SessionNotifier.onDismissed(context);
                break;
            case SessionMusic.ACTION_MUSIC:
                SessionMusic.control(context, key);
                break;
            default:
                break;
        }
    }
}
