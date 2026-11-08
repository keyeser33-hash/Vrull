package al.traininghub.musictest;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.IBinder;
import android.os.SystemClock;
import android.util.Log;

/**
 * Një "app muzike" pa zë për provën në emulator: sesioni i medias shpall luaj, pauzë, para, mbrapa dhe
 * pozicionin, si Spotify. Çdo komandë që vjen (nga Vrull, nga njoftimi i seancës) shkruhet te logcat
 * me etiketën VrullProva, që prova ta lexojë.
 */
public class PlayerService extends Service {

    static final String TAG = "VrullProva";
    private static final String CHANNEL = "prova";
    private static final String[][] SONGS = {
        { "Prova e ritmit", "Vrull" },
        { "Kënga e dytë", "Vrull" },
        { "Kënga e tretë", "Vrull" },
    };
    private static final long DURATION = 200_000L;
    private static final long ACTIONS = PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE
        | PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS | PlaybackState.ACTION_SEEK_TO;

    private MediaSession session;
    private int index;
    private boolean playing = true;
    private long position;
    private long updatedAt = SystemClock.elapsedRealtime();

    @Override
    public void onCreate() {
        super.onCreate();
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Prova", NotificationManager.IMPORTANCE_LOW));
        Notification notification = new Notification.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(getString(R.string.app_name))
            .build();
        startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);

        session = new MediaSession(this, TAG);
        session.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                playing = true;
                publish("play");
            }

            @Override
            public void onPause() {
                position = currentPosition();
                playing = false;
                publish("pause");
            }

            @Override
            public void onSkipToNext() {
                index = (index + 1) % SONGS.length;
                position = 0;
                playing = true;
                publish("next");
            }

            @Override
            public void onSkipToPrevious() {
                index = (index + SONGS.length - 1) % SONGS.length;
                position = 0;
                playing = true;
                publish("previous");
            }

            @Override
            public void onSeekTo(long to) {
                position = Math.max(0, Math.min(DURATION, to));
                publish("seekTo");
            }
        });
        session.setActive(true);
        publish("start");
    }

    private long currentPosition() {
        if (!playing) return position;
        return Math.min(DURATION, position + (SystemClock.elapsedRealtime() - updatedAt));
    }

    private void publish(String command) {
        updatedAt = SystemClock.elapsedRealtime();
        String[] song = SONGS[index];
        session.setMetadata(new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, song[0])
            .putString(MediaMetadata.METADATA_KEY_ARTIST, song[1])
            .putLong(MediaMetadata.METADATA_KEY_DURATION, DURATION)
            .build());
        session.setPlaybackState(new PlaybackState.Builder()
            .setActions(ACTIONS)
            .setState(playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED, position, playing ? 1f : 0f, updatedAt)
            .build());
        Log.i(TAG, "komanda " + command + " -> " + song[0] + (playing ? " luan" : " pauzë"));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        session.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
