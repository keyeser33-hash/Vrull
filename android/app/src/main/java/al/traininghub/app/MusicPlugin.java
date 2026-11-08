package al.traininghub.app;

import android.app.ActivityOptions;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSession;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Log;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Muzika "Trupi në ritëm" (SPEC V29, V2-E1-12, docs/research/muzika.md): lexon app-in e muzikës që
 * luan (Spotify, YouTube Music ose çdo tjetër) përmes sesioneve të medias së Android-it dhe i dërgon
 * vetëm komandat që vetë sesioni i shpall te PlaybackState.getActions(): luaj, pauzë, para, mbrapa,
 * pozicioni, dhe kënga e radhës kur app-i e jep radhën. Kërkon "Qasjen te njoftimet" për
 * MusicListenerService; pa të, çdo metodë që lexon sesionet kthen NO_ACCESS. Vrull nuk lexon asnjë
 * njoftim. JS-i: src/lib/music.ts; rreshti i muzikës te njoftimi i seancës: SessionMusic.java.
 *
 * Ngjarja "nowPlaying" vjen sa herë ndryshon kënga, gjendja, radha ose app-i që luan, nga
 * startListening deri te stopListening (seanca e hapur); nuk ka pyetje periodike.
 */
@CapacitorPlugin(name = "Music")
public class MusicPlugin extends Plugin {

    static final String TAG = "VrullMusic";
    private static final int QUEUE_PREVIEW = 5;

    private final Handler main = new Handler(Looper.getMainLooper());
    private MediaSessionManager manager;
    private ComponentName listener;
    private MediaController current;
    private boolean listening;

    private final MediaController.Callback callback = new MediaController.Callback() {
        @Override
        public void onMetadataChanged(MediaMetadata metadata) {
            emit();
        }

        @Override
        public void onPlaybackStateChanged(PlaybackState state) {
            emit();
        }

        @Override
        public void onQueueChanged(List<MediaSession.QueueItem> queue) {
            emit();
        }

        @Override
        public void onSessionDestroyed() {
            follow(activeControllers());
        }
    };

    private final MediaSessionManager.OnActiveSessionsChangedListener sessionsChanged = this::follow;

    @Override
    public void load() {
        manager = (MediaSessionManager) getContext().getSystemService(Context.MEDIA_SESSION_SERVICE);
        listener = new ComponentName(getContext(), MusicListenerService.class);
        // Rreshti i muzikës te njoftimi i seancës (V29, V2-E1-16a).
        SessionMusic.install();
    }

    /**
     * Leja, versioni i Android-it dhe kush e instaloi app-in: një APK nga një lidhje (jo nga një dyqan)
     * ka "cilësime të kufizuara" në Android 13+ (CDD 15 §9.8), që JS-i t'i shpjegojë hapat.
     */
    @PluginMethod
    public void getAccess(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasAccess(getContext()));
        result.put("sdk", Build.VERSION.SDK_INT);
        result.put("installer", installer(getContext()));
        call.resolve(result);
    }

    /** Faqja e lejes vetëm për Vrullin (Android 11+), përndryshe lista e "Qasjes te njoftimet". */
    @PluginMethod
    public void openAccessSettings(PluginCall call) {
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS);
            intent.putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, listener.flattenToString());
        } else {
            intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
        } catch (RuntimeException e) {
            Intent list = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            list.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(list);
        }
        call.resolve();
    }

    /**
     * "Info e app-it" e Vrullit: APK-ja e instaluar nga një lidhje shkarkimi ka "cilësime të
     * kufizuara" (Android 13+, CDD 15 §9.8); përdoruesi i lejon nga menyja ⋮ e kësaj faqeje.
     */
    @PluginMethod
    public void openAppInfo(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void getNowPlaying(PluginCall call) {
        if (!hasAccess(getContext())) {
            call.reject("Mungon qasja te njoftimet", "NO_ACCESS");
            return;
        }
        MediaController controller = pick(activeControllers());
        JSObject result = new JSObject();
        result.put("session", controller == null ? null : describe(getContext(), controller));
        call.resolve(result);
    }

    /**
     * Diagnostikimi (docs/research/muzika.md §1.5): çdo sesion aktiv, me veprimet dhe radhën që
     * shpall. Shkruhet edhe te logcat (VrullMusic).
     */
    @PluginMethod
    public void diagnose(PluginCall call) {
        if (!hasAccess(getContext())) {
            call.reject("Mungon qasja te njoftimet", "NO_ACCESS");
            return;
        }
        JSArray sessions = describeAll(getContext());
        Log.i(TAG, "diagnose: " + sessions);
        JSObject result = new JSObject();
        result.put("sessions", sessions);
        call.resolve(result);
    }

    /**
     * Një komandë te sesioni që luan: play, pause, next, previous, seekTo (positionMs) ose
     * skipToQueueItem (queueItemId). Refuzohet me UNSUPPORTED kur sesioni nuk e shpall veprimin.
     */
    @PluginMethod
    public void control(PluginCall call) {
        if (!hasAccess(getContext())) {
            call.reject("Mungon qasja te njoftimet", "NO_ACCESS");
            return;
        }
        MediaController controller = pick(activeControllers());
        if (controller == null) {
            call.reject("Asnjë app muzike nuk luan", "NO_SESSION");
            return;
        }
        String action = call.getString("action", "");
        long actions = actionsOf(controller);
        MediaController.TransportControls transport = controller.getTransportControls();
        switch (action) {
            case "play":
            case "pause":
            case "next":
            case "previous":
                if (!transport(controller, action)) break;
                call.resolve();
                return;
            case "seekTo": {
                Long position = CallNumbers.longOf(call, "positionMs");
                if (!has(actions, PlaybackState.ACTION_SEEK_TO) || position == null || position < 0) break;
                long duration = durationOf(controller);
                transport.seekTo(duration > 0 ? Math.min(position, duration) : position);
                call.resolve();
                return;
            }
            case "skipToQueueItem": {
                // Id-ja duhet të jetë te radha e tanishme: përndryshe sjellja është e papërcaktuar.
                Long id = CallNumbers.longOf(call, "queueItemId");
                if (!has(actions, PlaybackState.ACTION_SKIP_TO_QUEUE_ITEM) || id == null || !inQueue(controller, id)) break;
                transport.skipToQueueItem(id);
                call.resolve();
                return;
            }
            default:
                break;
        }
        call.reject("App-i i muzikës nuk e pranon këtë veprim", "UNSUPPORTED");
    }

    /** Hap app-in e muzikës që luan, te faqja e vet (getSessionActivity), pa leje për paketat e tjera. */
    @PluginMethod
    public void openApp(PluginCall call) {
        if (!hasAccess(getContext())) {
            call.reject("Mungon qasja te njoftimet", "NO_ACCESS");
            return;
        }
        MediaController controller = pick(activeControllers());
        if (controller == null) {
            call.reject("Asnjë app muzike nuk luan", "NO_SESSION");
            return;
        }
        PendingIntent activity = controller.getSessionActivity();
        if (activity == null) {
            call.reject("App-i i muzikës nuk e pranon këtë veprim", "UNSUPPORTED");
            return;
        }
        try {
            activity.send(getContext(), 0, null, null, null, null, sendOptions());
            call.resolve();
        } catch (PendingIntent.CanceledException e) {
            call.reject("App-i i muzikës nuk u hap", "UNSUPPORTED");
        }
    }

    /** Ngjarja "nowPlaying" sa herë ndryshon kënga, gjendja, radha ose app-i që luan. */
    @PluginMethod
    public void startListening(PluginCall call) {
        if (!hasAccess(getContext())) {
            call.reject("Mungon qasja te njoftimet", "NO_ACCESS");
            return;
        }
        if (!listening) {
            try {
                manager.addOnActiveSessionsChangedListener(sessionsChanged, listener, main);
                listening = true;
            } catch (SecurityException e) {
                call.reject("Mungon qasja te njoftimet", "NO_ACCESS");
                return;
            }
        }
        follow(activeControllers());
        // Leja mund të ketë ardhur tani: njoftimi i seancës merr rreshtin e muzikës.
        SessionNotifier.refresh(getContext());
        call.resolve();
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        stop();
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        stop();
    }

    private void stop() {
        if (listening) {
            manager.removeOnActiveSessionsChangedListener(sessionsChanged);
            listening = false;
        }
        if (current != null) {
            current.unregisterCallback(callback);
            current = null;
        }
    }

    private void follow(List<MediaController> controllers) {
        MediaController next = pick(controllers == null ? Collections.emptyList() : controllers);
        boolean same = current != null && next != null && current.getSessionToken().equals(next.getSessionToken());
        if (!same) {
            if (current != null) current.unregisterCallback(callback);
            current = next;
            if (current != null) current.registerCallback(callback, main);
        }
        emit();
    }

    private void emit() {
        if (!listening) return;
        JSObject event = new JSObject();
        event.put("session", current == null ? null : describe(getContext(), current));
        notifyListeners("nowPlaying", event);
    }

    private List<MediaController> activeControllers() {
        return controllers(getContext());
    }

    static boolean hasAccess(Context context) {
        return NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.getPackageName());
    }

    /**
     * Sesionet aktive të app-eve të tjera, sipas radhës së sistemit. Sesionet e vetë Vrullit (p.sh.
     * videoja e formës te WebView-i) nuk janë muzikë dhe nuk kontrollohen.
     */
    static List<MediaController> controllers(Context context) {
        MediaSessionManager sessions = (MediaSessionManager) context.getSystemService(Context.MEDIA_SESSION_SERVICE);
        if (sessions == null) return Collections.emptyList();
        List<MediaController> active;
        try {
            active = sessions.getActiveSessions(new ComponentName(context, MusicListenerService.class));
        } catch (SecurityException e) {
            return Collections.emptyList();
        }
        List<MediaController> others = new ArrayList<>();
        for (MediaController controller : active) {
            if (!context.getPackageName().equals(controller.getPackageName())) others.add(controller);
        }
        return others;
    }

    /** Sesioni që luan, sipas radhës së sistemit (më i rëndësishmi i pari); përndryshe i pari. */
    static MediaController pick(List<MediaController> controllers) {
        for (MediaController controller : controllers) {
            PlaybackState state = controller.getPlaybackState();
            if (state != null && state.getState() == PlaybackState.STATE_PLAYING) return controller;
        }
        return controllers.isEmpty() ? null : controllers.get(0);
    }

    static JSArray describeAll(Context context) {
        JSArray sessions = new JSArray();
        for (MediaController controller : controllers(context)) sessions.put(describe(context, controller));
        return sessions;
    }

    static JSObject describe(Context context, MediaController controller) {
        JSObject session = new JSObject();
        session.put("packageName", controller.getPackageName());
        session.put("appName", appName(context, controller.getPackageName()));
        session.put("canOpen", controller.getSessionActivity() != null);
        // Flamujt e sesionit: 4 (FLAG_HANDLES_QUEUE_COMMANDS i compat) do të thoshte që radha pranon shtime.
        session.put("flags", controller.getFlags());

        MediaMetadata metadata = controller.getMetadata();
        if (metadata != null) {
            session.put("title", text(metadata, MediaMetadata.METADATA_KEY_TITLE, MediaMetadata.METADATA_KEY_DISPLAY_TITLE));
            session.put("artist", text(metadata, MediaMetadata.METADATA_KEY_ARTIST, MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE));
            session.put("album", text(metadata, MediaMetadata.METADATA_KEY_ALBUM, null));
            long duration = metadata.getLong(MediaMetadata.METADATA_KEY_DURATION);
            session.put("durationMs", duration > 0 ? duration : null);
        }

        PlaybackState state = controller.getPlaybackState();
        if (state != null) {
            session.put("state", stateName(state.getState()));
            session.put("speed", state.getPlaybackSpeed());
            // Pozicioni i shtyrë deri tani; JS-i e vazhdon vetë nga positionAt, pa pyetur sërish.
            long position = state.getPosition();
            if (state.getState() == PlaybackState.STATE_PLAYING && state.getLastPositionUpdateTime() > 0) {
                position += (long) ((SystemClock.elapsedRealtime() - state.getLastPositionUpdateTime()) * state.getPlaybackSpeed());
            }
            session.put("positionMs", Math.max(0, position));
            session.put("positionAt", System.currentTimeMillis());
            session.put("activeQueueItemId", state.getActiveQueueItemId());
        }
        session.put("actions", actionNames(actionsOf(controller)));

        List<MediaSession.QueueItem> queue = controller.getQueue();
        JSObject queueInfo = new JSObject();
        // -1: sesioni nuk jep radhë (getQueue() == null), që të dallohet nga një radhë bosh.
        queueInfo.put("length", queue == null ? -1 : queue.size());
        CharSequence queueTitle = controller.getQueueTitle();
        queueInfo.put("title", queueTitle == null ? null : queueTitle.toString());
        JSArray upcoming = new JSArray();
        if (queue != null) {
            long active = state == null ? MediaSession.QueueItem.UNKNOWN_ID : state.getActiveQueueItemId();
            int start = 0;
            for (int i = 0; i < queue.size(); i++) {
                if (queue.get(i).getQueueId() == active) {
                    start = i + 1;
                    break;
                }
            }
            for (int i = start; i < queue.size() && upcoming.length() < QUEUE_PREVIEW; i++) {
                MediaSession.QueueItem item = queue.get(i);
                JSObject entry = new JSObject();
                entry.put("id", item.getQueueId());
                CharSequence title = item.getDescription().getTitle();
                CharSequence subtitle = item.getDescription().getSubtitle();
                entry.put("title", title == null ? null : title.toString());
                entry.put("subtitle", subtitle == null ? null : subtitle.toString());
                upcoming.put(entry);
            }
        }
        queueInfo.put("upcoming", upcoming);
        session.put("queue", queueInfo);
        return session;
    }

    /** Emri i app-it sipas sistemit; null kur paketa nuk duket (Android 11+, pa <queries> për të). */
    private static String appName(Context context, String packageName) {
        try {
            PackageManager packages = context.getPackageManager();
            ApplicationInfo info = packages.getApplicationInfo(packageName, 0);
            CharSequence label = packages.getApplicationLabel(info);
            return label == null ? null : label.toString();
        } catch (PackageManager.NameNotFoundException e) {
            return null;
        }
    }

    /** Paketa që instaloi Vrullin (dyqan app-esh, shfletues, skedar); null kur nuk dihet. */
    private static String installer(Context context) {
        try {
            PackageManager packages = context.getPackageManager();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                return packages.getInstallSourceInfo(context.getPackageName()).getInstallingPackageName();
            }
            return packages.getInstallerPackageName(context.getPackageName());
        } catch (PackageManager.NameNotFoundException | IllegalArgumentException e) {
            return null;
        }
    }

    /**
     * Android 14+ kërkon që dërguesi i një PendingIntent ta lejojë hapjen e faqes; Vrull është përpara
     * kur përdoruesi prek "Hap app-in e muzikës".
     */
    @SuppressWarnings("deprecation")
    private static Bundle sendOptions() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return null;
        ActivityOptions options = ActivityOptions.makeBasic();
        options.setPendingIntentBackgroundActivityStartMode(
            Build.VERSION.SDK_INT >= 36
                ? ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOW_IF_VISIBLE
                : ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED
        );
        return options.toBundle();
    }

    private static String text(MediaMetadata metadata, String key, String fallback) {
        CharSequence value = metadata.getText(key);
        if ((value == null || value.length() == 0) && fallback != null) value = metadata.getText(fallback);
        return value == null ? null : value.toString();
    }

    private static long actionsOf(MediaController controller) {
        PlaybackState state = controller.getPlaybackState();
        return state == null ? 0 : state.getActions();
    }

    /**
     * Luaj, pauzë, para ose mbrapa te sesioni, vetëm kur ai e shpall veprimin (seanca dhe njoftimi i
     * seancës, SessionMusic); false kur nuk e pranon.
     */
    static boolean transport(MediaController controller, String action) {
        long actions = actionsOf(controller);
        MediaController.TransportControls transport = controller.getTransportControls();
        switch (action) {
            case "play":
                if (!has(actions, PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PLAY_PAUSE)) return false;
                transport.play();
                return true;
            case "pause":
                if (!has(actions, PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE)) return false;
                transport.pause();
                return true;
            case "next":
                if (!has(actions, PlaybackState.ACTION_SKIP_TO_NEXT)) return false;
                transport.skipToNext();
                return true;
            case "previous":
                if (!has(actions, PlaybackState.ACTION_SKIP_TO_PREVIOUS)) return false;
                transport.skipToPrevious();
                return true;
            default:
                return false;
        }
    }

    private static long durationOf(MediaController controller) {
        MediaMetadata metadata = controller.getMetadata();
        return metadata == null ? 0 : metadata.getLong(MediaMetadata.METADATA_KEY_DURATION);
    }

    static boolean has(long actions, long wanted) {
        return (actions & wanted) != 0;
    }

    private static boolean inQueue(MediaController controller, long id) {
        List<MediaSession.QueueItem> queue = controller.getQueue();
        if (queue == null) return false;
        for (MediaSession.QueueItem item : queue) {
            if (item.getQueueId() == id) return true;
        }
        return false;
    }

    private static JSArray actionNames(long actions) {
        JSArray names = new JSArray();
        long[] flags = {
            PlaybackState.ACTION_PLAY, PlaybackState.ACTION_PAUSE, PlaybackState.ACTION_PLAY_PAUSE,
            PlaybackState.ACTION_SKIP_TO_NEXT, PlaybackState.ACTION_SKIP_TO_PREVIOUS, PlaybackState.ACTION_SEEK_TO,
            PlaybackState.ACTION_SKIP_TO_QUEUE_ITEM, PlaybackState.ACTION_PLAY_FROM_MEDIA_ID,
            PlaybackState.ACTION_PLAY_FROM_SEARCH, PlaybackState.ACTION_PLAY_FROM_URI, PlaybackState.ACTION_SET_PLAYBACK_SPEED,
        };
        String[] labels = {
            "play", "pause", "playPause", "next", "previous", "seekTo", "skipToQueueItem", "playFromMediaId",
            "playFromSearch", "playFromUri", "setPlaybackSpeed",
        };
        for (int i = 0; i < flags.length; i++) {
            if (has(actions, flags[i])) names.put(labels[i]);
        }
        return names;
    }

    private static String stateName(int state) {
        switch (state) {
            case PlaybackState.STATE_PLAYING:
                return "playing";
            case PlaybackState.STATE_PAUSED:
                return "paused";
            case PlaybackState.STATE_BUFFERING:
            case PlaybackState.STATE_CONNECTING:
                return "buffering";
            case PlaybackState.STATE_STOPPED:
                return "stopped";
            case PlaybackState.STATE_NONE:
                return "none";
            default:
                return "other";
        }
    }

    static boolean debuggable(Context context) {
        return (context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }
}
