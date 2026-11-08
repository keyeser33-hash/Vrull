package al.traininghub.app;

import android.annotation.SuppressLint;
import android.content.ComponentName;
import android.content.Context;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;
import androidx.annotation.Nullable;
import java.util.Collections;
import java.util.List;
import org.json.JSONObject;

/**
 * Muzika te njoftimi i seancës (SPEC V29, V2-E1-16a): rreshti nën "Ruaj setin" me këngën që luan dhe
 * kontrollet që app-i i muzikës pranon (mbrapa, luaj/pauzë, para), si mini-player-i i seancës.
 *
 * <p>Rreshti vizatohet këtu, pa WebView: SessionNotifier e kërkon sa herë vizaton njoftimin, edhe kur
 * procesi u nis nga një prekje te njoftimi. Sa kohë njoftimi i seancës duket, ky ndjek app-in e muzikës
 * (sesionet aktive dhe kënga, gjendja dhe veprimet e tij) dhe e rifreskon njoftimin vetëm kur ndryshon diçka
 * që rreshti tregon. Butonat janë PendingIntent broadcast te SessionActionReceiver, ndaj punojnë edhe me
 * ekran të kyçur; komanda i shkon app-it të muzikës vetëm kur ai e shpall te PlaybackState.getActions().
 * Pa "Qasjen te njoftimet" ose pa app muzike, rreshti mungon. Tempo ("138 BPM") mbetet te seanca: vjen
 * nga JS-i dhe rrjeti, ndërsa njoftimi ndërrohet edhe kur WebView-i fle.
 */
final class SessionMusic implements SessionNotifier.MusicRow {

    static final String ACTION_MUSIC = "al.traininghub.app.session.MUSIC";
    /** Rifreskimet e shpejta (kënga dhe gjendja ndryshojnë bashkë) bëhen një, nën kufirin e Android-it. */
    private static final long REFRESH_DELAY_MS = 250;

    private static final SessionMusic ROW = new SessionMusic();
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    /** Shenja e rifreskimit në pritje te MAIN, që një ndryshim i ri ta zëvendësojë. */
    private static final Object REFRESH = new Object();

    /** Çfarë tregoi rreshti herën e fundit: një ndryshim tjetër i app-it të muzikës nuk e rivizaton njoftimin. */
    @Nullable
    private static volatile String shown;
    /** Vetëm në thread-in kryesor; mban vetëm kontekstin e aplikacionit, jo një aktivitet. */
    @SuppressLint("StaticFieldLeak")
    @Nullable
    private static Follower follower;

    private SessionMusic() {}

    /** Rreshti i muzikës te njoftimi i seancës: nga MusicPlugin.load dhe nga SessionActionReceiver. */
    static void install() {
        SessionNotifier.setMusicRow(ROW);
    }

    @Nullable
    @Override
    public RemoteViews build(Context context, JSONObject texts) {
        MediaController controller = playing(context);
        Song song = controller == null ? null : Song.of(controller);
        shown = song == null ? "" : song.signature();
        if (song == null) return null;

        RemoteViews row = new RemoteViews(context.getPackageName(), R.layout.notification_music);
        row.setTextViewText(R.id.music_title, song.title == null ? texts.optString("musicUntitled") : song.title);
        row.setTextViewText(R.id.music_artist, song.artist == null ? "" : song.artist);
        row.setViewVisibility(R.id.music_artist, song.artist == null ? View.GONE : View.VISIBLE);

        String toggle = song.playing ? "pause" : "play";
        boolean canToggle = song.playing
            ? MusicPlugin.has(song.actions, PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE)
            : MusicPlugin.has(song.actions, PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PLAY_PAUSE);
        row.setImageViewResource(R.id.music_play_pause, song.playing ? R.drawable.ic_notification_pause : R.drawable.ic_notification_play);
        button(context, row, R.id.music_play_pause, canToggle, toggle, texts.optString(song.playing ? "musicPause" : "musicPlay"));
        button(context, row, R.id.music_previous, MusicPlugin.has(song.actions, PlaybackState.ACTION_SKIP_TO_PREVIOUS), "previous", texts.optString("musicPrevious"));
        button(context, row, R.id.music_next, MusicPlugin.has(song.actions, PlaybackState.ACTION_SKIP_TO_NEXT), "next", texts.optString("musicNext"));
        return row;
    }

    @Override
    public void showing(Context context, boolean visible) {
        Context app = context.getApplicationContext();
        MAIN.post(() -> {
            if (visible && follower == null && MusicPlugin.hasAccess(app)) {
                Follower next = new Follower(app);
                if (next.start()) follower = next;
            } else if (!visible && follower != null) {
                follower.stop();
                follower = null;
            }
        });
    }

    /** Një prekje te rreshti: luaj, pauzë, para ose mbrapa, te app-i i muzikës që luan. */
    static void control(Context context, @Nullable String command) {
        if (command == null || !MusicPlugin.hasAccess(context)) return;
        MediaController controller = playing(context);
        if (controller != null) MusicPlugin.transport(controller, command);
        // App-i i muzikës e ndryshon gjendjen pak më vonë; ndjekësi e kap, kjo mbulon rastin pa të.
        changed(context);
    }

    @Nullable
    private static MediaController playing(Context context) {
        if (!MusicPlugin.hasAccess(context)) return null;
        return MusicPlugin.pick(MusicPlugin.controllers(context));
    }

    private static void button(Context context, RemoteViews row, int id, boolean visible, String command, String description) {
        row.setViewVisibility(id, visible ? View.VISIBLE : View.GONE);
        if (!visible) return;
        row.setContentDescription(id, description);
        row.setOnClickPendingIntent(id, SessionNotifier.broadcast(context, ACTION_MUSIC, command));
    }

    /** Rifreskon njoftimin kur kënga, gjendja ose veprimet ndryshojnë nga ato që tregon rreshti. */
    private static void changed(Context context) {
        Context app = context.getApplicationContext();
        MAIN.removeCallbacksAndMessages(REFRESH);
        MAIN.postAtTime(() -> {
            MediaController controller = playing(app);
            Song song = controller == null ? null : Song.of(controller);
            String now = song == null ? "" : song.signature();
            if (!now.equals(shown)) SessionNotifier.refresh(app);
        }, REFRESH, SystemClock.uptimeMillis() + REFRESH_DELAY_MS);
    }

    /** Kënga dhe gjendja që tregon rreshti. */
    private static final class Song {

        @Nullable
        final String title;
        @Nullable
        final String artist;
        final boolean playing;
        final long actions;

        private Song(@Nullable String title, @Nullable String artist, boolean playing, long actions) {
            this.title = title;
            this.artist = artist;
            this.playing = playing;
            this.actions = actions;
        }

        static Song of(MediaController controller) {
            MediaMetadata metadata = controller.getMetadata();
            PlaybackState state = controller.getPlaybackState();
            int status = state == null ? PlaybackState.STATE_NONE : state.getState();
            boolean playing = status == PlaybackState.STATE_PLAYING || status == PlaybackState.STATE_BUFFERING;
            return new Song(
                metadata == null ? null : text(metadata, MediaMetadata.METADATA_KEY_TITLE, MediaMetadata.METADATA_KEY_DISPLAY_TITLE),
                metadata == null ? null : text(metadata, MediaMetadata.METADATA_KEY_ARTIST, MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE),
                playing,
                state == null ? 0 : state.getActions()
            );
        }

        String signature() {
            return title + "\n" + artist + "\n" + playing + "\n" + actions;
        }

        @Nullable
        private static String text(MediaMetadata metadata, String key, String fallback) {
            CharSequence value = metadata.getText(key);
            if (value == null || value.length() == 0) value = metadata.getText(fallback);
            return value == null || value.length() == 0 ? null : value.toString();
        }
    }

    /** Ndjek app-in e muzikës (sesionet aktive dhe atë që luan) sa kohë njoftimi i seancës duket. */
    private static final class Follower {

        private final Context context;
        @Nullable
        private final MediaSessionManager manager;
        private final ComponentName listener;
        @Nullable
        private MediaController current;

        private final MediaSessionManager.OnActiveSessionsChangedListener sessions = controllers -> follow();

        private final MediaController.Callback callback = new MediaController.Callback() {
            @Override
            public void onMetadataChanged(@Nullable MediaMetadata metadata) {
                changed(context);
            }

            @Override
            public void onPlaybackStateChanged(@Nullable PlaybackState state) {
                changed(context);
            }

            @Override
            public void onSessionDestroyed() {
                follow();
            }
        };

        Follower(Context context) {
            this.context = context;
            this.manager = (MediaSessionManager) context.getSystemService(Context.MEDIA_SESSION_SERVICE);
            this.listener = new ComponentName(context, MusicListenerService.class);
        }

        boolean start() {
            if (manager == null) return false;
            try {
                manager.addOnActiveSessionsChangedListener(sessions, listener, MAIN);
            } catch (SecurityException e) {
                return false;
            }
            follow();
            return true;
        }

        void stop() {
            if (manager != null) manager.removeOnActiveSessionsChangedListener(sessions);
            if (current != null) current.unregisterCallback(callback);
            current = null;
        }

        private void follow() {
            List<MediaController> controllers = MusicPlugin.controllers(context);
            MediaController next = MusicPlugin.pick(controllers == null ? Collections.emptyList() : controllers);
            boolean same = current != null && next != null && current.getSessionToken().equals(next.getSessionToken());
            if (!same) {
                if (current != null) current.unregisterCallback(callback);
                current = next;
                if (current != null) current.registerCallback(callback, MAIN);
            }
            changed(context);
        }
    }
}
