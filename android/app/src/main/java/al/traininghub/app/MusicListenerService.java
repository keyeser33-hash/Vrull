package al.traininghub.app;

import android.service.notification.NotificationListenerService;
import android.util.Log;

/**
 * Muzika (SPEC V29, spike E1-03, docs/research/muzika.md). Android-i jep sesionet e medias së
 * app-eve të tjera (MediaSessionManager.getActiveSessions) vetëm një app-i që ka "Qasjen te
 * njoftimet". Ky shërbim ekziston vetëm për atë leje: nuk lexon asnjë njoftim, dhe manifesti i
 * kërkon sistemit zero lloje njoftimesh (default_filter_types bosh, Android 12+).
 */
public class MusicListenerService extends NotificationListenerService {

    @Override
    public void onListenerConnected() {
        // Prova pa ekran: adb shell cmd notification allow_listener
        // al.traininghub.app/al.traininghub.app.MusicListenerService, pastaj adb logcat -s VrullMusic.
        Log.i(MusicPlugin.TAG, "Qasja te njoftimet u lidh; sesionet: " + MusicPlugin.describeAll(this));
    }
}
