package al.traininghub.app;

import android.annotation.SuppressLint;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Njoftimi i seancës dhe seti nga njoftimi (V2-E1-08, SPEC §0.3a "Seti nga njoftimi").
 *
 * <p>JS-i (lib/session-notification.ts) jep gjendjen: seancën, setet që vijnë si të ruhen me vlerat
 * e propozuara dhe tekstet në gjuhën e app-it. Këtu ajo ruhet te SharedPreferences ("vrull_session")
 * bashkë me radhën e prekjeve, ndryshimet me −/+ dhe pushimin, që njoftimi të punojë edhe kur
 * WebView-i fle ose procesi është vrarë: SessionActionReceiver e zgjon procesin, prekja shkon te
 * radha, njoftimi kalon te seti tjetër dhe pushimi nis me alarmin e vet. JS-i e zbraz radhën kur
 * njoftohet (SessionNotificationPlugin) ose në nisjen e radhës, dhe e zbaton një herë.
 *
 * <p>Njoftimet: seanca (4200, kanali "seanca", pa zë), pushimi gjatë numërimit (4202, i njëjti
 * kanal, kronometri i Android-it që numëron vetë) dhe "Pushimi mbaroi" (4201, kanali "pushimi" me
 * zë dhe dridhje, si te v1). Të gjitha VISIBILITY_PUBLIC: setet dhe peshat e stërvitjes nuk janë
 * ndër të dhënat private të V5, dhe "Ruaj setin" duhet të punojë me ekran të kyçur; përdoruesi e
 * fsheh me cilësimet e Android-it (ekrani i kyçur, kanali).
 */
final class SessionNotifier {

    static final String ACTION_SAVE = "al.traininghub.app.session.SAVE";
    static final String ACTION_LOWER = "al.traininghub.app.session.LOWER";
    static final String ACTION_RAISE = "al.traininghub.app.session.RAISE";
    static final String ACTION_SKIP_REST = "al.traininghub.app.session.SKIP_REST";
    static final String ACTION_REST_DONE = "al.traininghub.app.session.REST_DONE";
    static final String ACTION_DISMISSED = "al.traininghub.app.session.DISMISSED";
    static final String ACTION_OPEN = "al.traininghub.app.session.OPEN";
    static final String EXTRA_KEY = "key";

    /**
     * Rreshti i muzikës te njoftimi i seancës (V29; SessionMusic, V2-E1-16a). Regjistrohet me
     * {@link #setMusicRow} (MusicPlugin.load dhe SessionActionReceiver, edhe kur procesi nis nga një
     * prekje) dhe thërret {@link #refresh} kur ndryshon kënga ose gjendja; njoftimi e vendos te
     * {@code music_slot} i notification_session_big.xml, nën "Ruaj setin". Butonat e rreshtit janë
     * PendingIntent broadcast, që punojnë edhe me ekran të kyçur. Pa rresht (null), vendi mbetet i fshehur.
     */
    interface MusicRow {
        /** Rreshti me tekstet e gjendjes së fundit të JS-it (gjuha e app-it); null pa muzikë. */
        @Nullable
        RemoteViews build(Context context, JSONObject texts);

        /** Njoftimi i seancës u shfaq ose u hoq: rreshti ndjek app-in e muzikës vetëm sa kohë duket. */
        void showing(Context context, boolean visible);
    }

    private static final String PREFS = "vrull_session";
    private static final String KEY_STATE = "state";
    private static final String KEY_QUEUE = "queue";
    private static final String KEY_ADJUST = "adjust";
    private static final String KEY_REST = "rest";
    private static final String KEY_DISMISSED = "dismissed";

    private static final String CHANNEL_SESSION = "seanca";
    // I njëjti kanal me njoftimin e pushimit të v1 (LocalNotifications): zgjedhjet e përdoruesit mbeten.
    private static final String CHANNEL_REST_DONE = "pushimi";
    private static final int ID_SESSION = 4200;
    private static final int ID_REST_DONE = 4201;
    private static final int ID_REST = 4202;
    /** Prushi i Vrullit (tokeni `ember`), për ikonën e njoftimit. */
    private static final int EMBER = 0xFFFF5B2E;
    /** Radha nuk rritet pa fund kur app-i nuk hapet për shumë kohë. */
    private static final int MAX_QUEUE = 200;

    private static final Object LOCK = new Object();
    // Një vizatim në një kohë: një vizatim i vonuar me gjendjen e vjetër nuk e mbulon një më të ri.
    private static final Object RENDER = new Object();
    @Nullable
    private static volatile MusicRow musicRow;

    private SessionNotifier() {}

    static void setMusicRow(@Nullable MusicRow row) {
        musicRow = row;
    }

    /** Vizaton përsëri njoftimet nga gjendja e ruajtur (p.sh. pas një ndryshimi të muzikës). */
    static void refresh(Context context) {
        render(context);
    }

    // ---- Nga JS-i ----

    /** Gjendja e re nga JS-i; ndryshimet me −/+ mbeten për setet që janë ende në njoftim. */
    static void show(Context context, JSONObject state) {
        synchronized (LOCK) {
            SharedPreferences prefs = prefs(context);
            JSONObject adjust = object(prefs.getString(KEY_ADJUST, null));
            JSONObject kept = new JSONObject();
            JSONArray steps = state.optJSONArray("steps");
            for (int i = 0; steps != null && i < steps.length(); i++) {
                String key = steps.optJSONObject(i).optString("key");
                if (adjust.has(key)) put(kept, key, adjust.optInt(key));
            }
            SharedPreferences.Editor editor = prefs.edit().putString(KEY_STATE, state.toString()).putString(KEY_ADJUST, kept.toString());
            // Njoftimi i hequr nga përdoruesi mbetet i hequr vetëm për atë seancë.
            if (!state.optString("sessionId").equals(prefs.getString(KEY_DISMISSED, ""))) editor.remove(KEY_DISMISSED);
            editor.commit();
        }
        render(context);
    }

    /** Pa seancë të hapur: njoftimi dhe pushimi hiqen; radha mbetet derisa JS-i ta zbrazë. */
    static void hide(Context context) {
        synchronized (LOCK) {
            prefs(context).edit().remove(KEY_STATE).remove(KEY_ADJUST).remove(KEY_DISMISSED).commit();
        }
        cancelRest(context);
        NotificationManagerCompat.from(context).cancel(ID_SESSION);
        MusicRow row = musicRow;
        if (row != null) row.showing(context, false);
    }

    static JSONArray pending(Context context) {
        synchronized (LOCK) {
            return array(prefs(context).getString(KEY_QUEUE, null));
        }
    }

    static void ack(Context context, Set<String> ids) {
        synchronized (LOCK) {
            SharedPreferences prefs = prefs(context);
            JSONArray queue = array(prefs.getString(KEY_QUEUE, null));
            JSONArray kept = new JSONArray();
            for (int i = 0; i < queue.length(); i++) {
                JSONObject action = queue.optJSONObject(i);
                if (action != null && !ids.contains(action.optString("id"))) kept.put(action);
            }
            prefs.edit().putString(KEY_QUEUE, kept.toString()).commit();
        }
        render(context);
    }

    // ---- Pushimi ----

    /** Pushimi deri në `endsAt`: alarmi i saktë për "Pushimi mbaroi" dhe njoftimi me kronometrin. */
    static void startRest(Context context, long endsAt, String title, String body, String channel, String channelText) {
        JSONObject rest = new JSONObject();
        put(rest, "endsAt", endsAt);
        put(rest, "title", title);
        put(rest, "body", body);
        put(rest, "channel", channel);
        put(rest, "channelText", channelText);
        synchronized (LOCK) {
            prefs(context).edit().putString(KEY_REST, rest.toString()).commit();
        }
        NotificationManagerCompat.from(context).cancel(ID_REST_DONE);
        scheduleAlarm(context, endsAt);
        render(context);
    }

    static void cancelRest(Context context) {
        synchronized (LOCK) {
            prefs(context).edit().remove(KEY_REST).commit();
        }
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        if (alarms != null) alarms.cancel(restDoneIntent(context));
        NotificationManagerCompat.from(context).cancel(ID_REST);
    }

    /** Alarmi: pushimi mbaroi. Njoftimi "Pushimi mbaroi" bie me zë dhe dridhje. */
    static void restDone(Context context) {
        JSONObject rest;
        synchronized (LOCK) {
            SharedPreferences prefs = prefs(context);
            rest = object(prefs.getString(KEY_REST, null));
            if (!rest.has("endsAt")) return;
            // Një alarm i vonuar pas një pushimi të ri (+15 s) pret alarmin e vet.
            if (rest.optLong("endsAt") > System.currentTimeMillis() + 2000) return;
            prefs.edit().remove(KEY_REST).commit();
        }
        NotificationManagerCompat manager = NotificationManagerCompat.from(context);
        manager.cancel(ID_REST);
        if (!manager.areNotificationsEnabled()) return;
        ensureRestChannel(context, rest.optString("channel"), rest.optString("channelText"));
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_REST_DONE)
            .setSmallIcon(R.drawable.ic_stat_pushimi)
            .setColor(EMBER)
            .setContentTitle(rest.optString("title"))
            .setContentText(rest.optString("body"))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(openIntent(context, null, null, -1, ID_REST_DONE));
        notify(context, ID_REST_DONE, builder.build());
    }

    // ---- Prekjet te njoftimi (SessionActionReceiver) ----

    /**
     * "Ruaj setin": seti në njoftim hyn te radha me vlerat e treguara, njoftimi kalon te seti
     * tjetër dhe pushimi nis. Një prekje mbi një set që nuk është më në njoftim (prekja e dytë,
     * para se të vizatohet njoftimi i ri) nuk bën asgjë: i njëjti set nuk ruhet dy herë.
     */
    static void onSave(Context context, String key) {
        long restEndsAt = 0;
        JSONObject texts;
        synchronized (LOCK) {
            State state = State.load(prefs(context));
            int index = state == null ? -1 : state.current();
            if (index < 0) return;
            JSONObject step = state.steps.optJSONObject(index);
            if (!key.equals(step.optString("key")) || !step.optBoolean("canSave")) return;
            long now = System.currentTimeMillis();
            int restSeconds = step.optInt("restAfter");
            if (restSeconds > 0) restEndsAt = now + restSeconds * 1000L;
            boolean timed = "timed".equals(step.optString("tracking"));
            int count = state.count(index);
            JSONObject action = new JSONObject();
            put(action, "id", UUID.randomUUID().toString());
            put(action, "type", "save");
            put(action, "at", now);
            put(action, "sessionId", state.sessionId);
            for (String field : new String[] { "key", "slotId", "exerciseId", "position", "setNumber", "segment", "technique", "weightKg", "rir" }) {
                put(action, field, step.opt(field));
            }
            put(action, "reps", timed ? JSONObject.NULL : count);
            put(action, "seconds", timed ? count : JSONObject.NULL);
            put(action, "restEndsAt", restSeconds > 0 ? restEndsAt : JSONObject.NULL);
            put(action, "restSeconds", restSeconds > 0 ? restSeconds : JSONObject.NULL);
            state.queue.put(action);
            state.adjust.remove(key);
            state.save(prefs(context));
            texts = state.texts;
        }
        NotificationManagerCompat.from(context).cancel(ID_REST_DONE);
        // Seti i ri e mbyll pushimin e mëparshëm, si te seanca; pushimi i tij nis vetëm kur ka.
        if (restEndsAt > 0) {
            startRest(
                context,
                restEndsAt,
                texts.optString("restDoneTitle"),
                texts.optString("restDoneBody"),
                texts.optString("restChannel"),
                texts.optString("restChannelText")
            );
        } else {
            cancelRest(context);
            render(context);
        }
        SessionNotificationPlugin.emitAction();
    }

    /** −/+ ndryshojnë përsëritjet (ose sekondat me 5) e setit në njoftim; ruhen vetëm me "Ruaj setin". */
    static void onAdjust(Context context, String key, int direction) {
        synchronized (LOCK) {
            State state = State.load(prefs(context));
            int index = state == null ? -1 : state.current();
            if (index < 0) return;
            JSONObject step = state.steps.optJSONObject(index);
            if (!key.equals(step.optString("key"))) return;
            boolean timed = "timed".equals(step.optString("tracking"));
            int next = state.count(index) + direction * (timed ? 5 : 1);
            next = timed ? Math.max(5, Math.min(3600, next)) : Math.max(1, Math.min(999, next));
            put(state.adjust, key, next);
            state.save(prefs(context));
        }
        render(context);
    }

    static void onSkipRest(Context context) {
        synchronized (LOCK) {
            State state = State.load(prefs(context));
            if (state != null) {
                JSONObject action = new JSONObject();
                put(action, "id", UUID.randomUUID().toString());
                put(action, "type", "skip_rest");
                put(action, "at", System.currentTimeMillis());
                put(action, "sessionId", state.sessionId);
                state.queue.put(action);
                state.save(prefs(context));
            }
        }
        cancelRest(context);
        SessionNotificationPlugin.emitAction();
    }

    /** Përdoruesi e hoqi njoftimin (Android 14+, me ekran të shkyçur): nuk rikthehet në këtë seancë. */
    static void onDismissed(Context context) {
        synchronized (LOCK) {
            SharedPreferences prefs = prefs(context);
            String sessionId = object(prefs.getString(KEY_STATE, null)).optString("sessionId");
            if (!sessionId.isEmpty()) prefs.edit().putString(KEY_DISMISSED, sessionId).commit();
        }
    }

    // ---- Vizatimi ----

    static void render(Context context) {
        synchronized (RENDER) {
            State state;
            JSONObject rest;
            boolean dismissed;
            synchronized (LOCK) {
                SharedPreferences prefs = prefs(context);
                state = State.load(prefs);
                rest = object(prefs.getString(KEY_REST, null));
                dismissed = state != null && state.sessionId.equals(prefs.getString(KEY_DISMISSED, ""));
            }
            NotificationManagerCompat manager = NotificationManagerCompat.from(context);
            boolean visible = state != null && !dismissed && manager.areNotificationsEnabled();
            if (!visible) manager.cancel(ID_SESSION);
            else notify(context, ID_SESSION, sessionNotification(context, state));
            MusicRow row = musicRow;
            if (row != null) row.showing(context, visible);
            long endsAt = rest.optLong("endsAt");
            // Pushimi pa tekstet e njoftimit (JS-i s'e ka dërguar ende gjendjen): vetëm alarmi.
            if (state == null || endsAt <= System.currentTimeMillis() || !manager.areNotificationsEnabled()) manager.cancel(ID_REST);
            else notify(context, ID_REST, restNotification(context, state, endsAt));
        }
    }

    private static Notification sessionNotification(Context context, State state) {
        ensureSessionChannel(context, state.texts);
        JSONObject texts = state.texts;
        int index = state.current();
        RemoteViews small = new RemoteViews(context.getPackageName(), R.layout.notification_session);
        RemoteViews big = new RemoteViews(context.getPackageName(), R.layout.notification_session_big);
        PendingIntent open = openIntent(context, index < 0 ? null : state.steps.optJSONObject(index), state, index, ID_SESSION);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_SESSION)
            .setSmallIcon(R.drawable.ic_stat_vrull)
            .setColor(EMBER)
            .setSubText(texts.optString("session"))
            .setWhen(state.startedAt)
            .setShowWhen(true)
            .setUsesChronometer(true)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(open)
            .setDeleteIntent(broadcast(context, ACTION_DISMISSED, null))
            .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
            .setCustomContentView(small)
            .setCustomBigContentView(big);

        if (index < 0) {
            // Të gjitha setet e njoftimit u ruajtën: mbyllja (ose seti tjetër, kur JS-i i preu) bëhet te app-i.
            String title = texts.optString(state.complete ? "allDone" : "openApp");
            String text = state.complete ? texts.optString("allDoneText") : "";
            for (RemoteViews views : new RemoteViews[] { small, big }) {
                views.setTextViewText(R.id.title, title);
                views.setViewVisibility(R.id.save, View.GONE);
            }
            small.setTextViewText(R.id.summary, text);
            big.setViewVisibility(R.id.numbers, View.GONE);
            big.setViewVisibility(R.id.controls, View.GONE);
            big.setTextViewText(R.id.target, text);
            builder.setContentTitle(title).setContentText(text);
        } else {
            JSONObject step = state.steps.optJSONObject(index);
            boolean timed = "timed".equals(step.optString("tracking"));
            int count = state.count(index);
            String unit = texts.optString(timed ? (count == 1 ? "secondsOne" : "secondsOther") : (count == 1 ? "repsOne" : "repsOther"));
            String weight = step.isNull("weight") ? null : step.optString("weight");
            String target = step.isNull("target") ? null : step.optString("target");
            String title = step.optString("title");
            String summary = (weight == null ? "" : weight + " kg × ") + count + " " + unit;
            boolean canSave = step.optBoolean("canSave");

            for (RemoteViews views : new RemoteViews[] { small, big }) views.setTextViewText(R.id.title, title);
            small.setTextViewText(R.id.summary, canSave ? summary : target);
            big.setViewVisibility(R.id.weight, weight == null ? View.GONE : View.VISIBLE);
            big.setViewVisibility(R.id.weight_unit, weight == null ? View.GONE : View.VISIBLE);
            big.setViewVisibility(R.id.times, weight == null ? View.GONE : View.VISIBLE);
            big.setTextViewText(R.id.weight, weight == null ? "" : weight);
            big.setTextViewText(R.id.count, String.valueOf(count));
            big.setTextViewText(R.id.count_unit, unit);
            big.setContentDescription(R.id.numbers, summary);
            big.setViewVisibility(R.id.numbers, canSave ? View.VISIBLE : View.GONE);
            big.setViewVisibility(R.id.target, target == null ? View.GONE : View.VISIBLE);
            big.setTextViewText(R.id.target, target == null ? "" : target);

            String key = step.optString("key");
            if (canSave) {
                String save = texts.optString(step.isNull("segment") ? "save" : "saveSegment");
                PendingIntent saveIntent = broadcast(context, ACTION_SAVE, key);
                big.setTextViewText(R.id.save, save);
                small.setTextViewText(R.id.save, texts.optString("saveShort"));
                small.setContentDescription(R.id.save, save);
                big.setOnClickPendingIntent(R.id.save, saveIntent);
                small.setOnClickPendingIntent(R.id.save, saveIntent);
                big.setOnClickPendingIntent(R.id.lower, broadcast(context, ACTION_LOWER, key));
                big.setOnClickPendingIntent(R.id.raise, broadcast(context, ACTION_RAISE, key));
                big.setContentDescription(R.id.lower, texts.optString(timed ? "secondsLower" : "repsLower"));
                big.setContentDescription(R.id.raise, texts.optString(timed ? "secondsRaise" : "repsRaise"));
            } else {
                // Pesha zgjidhet te app-i: butoni kryesor e hap atë, pa −/+.
                big.setViewVisibility(R.id.lower, View.GONE);
                big.setViewVisibility(R.id.raise, View.GONE);
                big.setTextViewText(R.id.save, texts.optString("edit"));
                big.setOnClickPendingIntent(R.id.save, open);
                small.setViewVisibility(R.id.save, View.GONE);
            }
            builder.setContentTitle(title).setContentText(canSave ? summary : target);
            builder.addAction(0, texts.optString("edit"), open);
        }

        MusicRow row = musicRow;
        RemoteViews music = row == null ? null : row.build(context, texts);
        if (music != null) {
            big.removeAllViews(R.id.music_slot);
            big.addView(R.id.music_slot, music);
            big.setViewVisibility(R.id.music_slot, View.VISIBLE);
        }
        return builder.build();
    }

    private static Notification restNotification(Context context, State state, long endsAt) {
        ensureSessionChannel(context, state.texts);
        JSONObject texts = state.texts;
        // Kronometri numëron vetë te SystemUI, edhe kur procesi fle; baza është në kohën e nisjes së telefonit.
        long base = SystemClock.elapsedRealtime() + (endsAt - System.currentTimeMillis());
        RemoteViews small = restViews(context, base, texts.optString("restEnds", "%s"));
        RemoteViews big = restViews(context, base, texts.optString("restEnds", "%s"));
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_SESSION)
            .setSmallIcon(R.drawable.ic_stat_pushimi)
            .setColor(EMBER)
            .setSubText(texts.optString("rest"))
            .setShowWhen(false)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentTitle(texts.optString("rest"))
            .setContentIntent(openIntent(context, null, state, -1, ID_REST))
            .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
            .setCustomContentView(small)
            .setCustomBigContentView(big)
            // Hiqet vetë kur mbaron pushimi, edhe pa proces; alarmi e heq edhe në Android 7.
            .setTimeoutAfter(Math.max(1000, endsAt - System.currentTimeMillis()))
            .addAction(0, texts.optString("skipRest"), broadcast(context, ACTION_SKIP_REST, null));
        return builder.build();
    }

    private static RemoteViews restViews(Context context, long base, String format) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.notification_rest);
        views.setChronometer(R.id.rest_countdown, base, format, true);
        views.setChronometerCountDown(R.id.rest_countdown, true);
        return views;
    }

    // ---- Ndihmësit ----

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    @SuppressLint("MissingPermission")
    private static void notify(Context context, int id, Notification notification) {
        NotificationManagerCompat manager = NotificationManagerCompat.from(context);
        if (!manager.areNotificationsEnabled()) return;
        try {
            manager.notify(id, notification);
        } catch (SecurityException ignored) {
            // Leja e njoftimeve u hoq ndërkohë: seanca vazhdon te app-i.
        }
    }

    /**
     * Një PendingIntent për çdo veprim dhe set (ose komandë muzike): një prekje e vjetër mbart setin e vet,
     * jo të riun.
     */
    static PendingIntent broadcast(Context context, String action, @Nullable String key) {
        Intent intent = new Intent(context, SessionActionReceiver.class).setAction(action);
        if (key != null) {
            intent.setData(new Uri.Builder().scheme("vrull-session").authority(action).appendPath(key).build());
            intent.putExtra(EXTRA_KEY, key);
        }
        return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /**
     * "Ndrysho" dhe prekja e njoftimit: hap app-in te seanca, te ky set kur ka një. Çdo njoftim ka
     * kodin e vet, që hapja e pushimit të mos ua ndryshojë setin "Ndrysho"-s së seancës.
     */
    private static PendingIntent openIntent(Context context, @Nullable JSONObject step, @Nullable State state, int index, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class)
            .setAction(ACTION_OPEN)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (state != null) intent.putExtra("sessionId", state.sessionId);
        if (step != null && state != null) {
            boolean timed = "timed".equals(step.optString("tracking"));
            intent.putExtra("slotId", step.optString("slotId"));
            intent.putExtra("setNumber", step.optInt("setNumber"));
            intent.putExtra("segment", !step.isNull("segment"));
            intent.putExtra(timed ? "seconds" : "reps", state.count(index));
        }
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static PendingIntent restDoneIntent(Context context) {
        Intent intent = new Intent(context, SessionActionReceiver.class).setAction(ACTION_REST_DONE);
        return PendingIntent.getBroadcast(context, ID_REST_DONE, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Alarm i saktë kur lejohet (Android 12: përdoruesi; 13+: USE_EXACT_ALARM), përndryshe sa më afër. */
    @SuppressLint("MissingPermission")
    private static void scheduleAlarm(Context context, long at) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        if (alarms == null) return;
        PendingIntent intent = restDoneIntent(context);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarms.canScheduleExactAlarms()) {
                alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent);
            } else {
                alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent);
            }
        } catch (SecurityException e) {
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent);
        }
    }

    private static void ensureSessionChannel(Context context, JSONObject texts) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        // Pa zë dhe pa dridhje: njoftimi ndryshon me çdo set. Rëndësia e zakonshme e mban te
        // njoftimet që shfaqen në ekranin e kyçur (jo te "të heshturat"), pa dalë sipër ekranit.
        NotificationChannel channel = new NotificationChannel(CHANNEL_SESSION, texts.optString("channel", "Vrull"), NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription(texts.optString("channelText"));
        channel.setSound(null, null);
        channel.enableVibration(false);
        channel.setShowBadge(false);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(channel);
    }

    private static void ensureRestChannel(Context context, String name, String description) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        // Si kanali i v1 (lib/rest-alarm.ts): sipër ekranit, me zë dhe dridhje.
        NotificationChannel channel = new NotificationChannel(CHANNEL_REST_DONE, name.isEmpty() ? "Vrull" : name, NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription(description);
        channel.enableVibration(true);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(channel);
    }

    private static JSONObject object(@Nullable String json) {
        if (json == null) return new JSONObject();
        try {
            return new JSONObject(json);
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    private static JSONArray array(@Nullable String json) {
        if (json == null) return new JSONArray();
        try {
            return new JSONArray(json);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static void put(JSONObject target, String name, @Nullable Object value) {
        try {
            target.put(name, value == null ? JSONObject.NULL : value);
        } catch (JSONException ignored) {
            // Emrat janë fiksë dhe vlerat të thjeshta: put nuk dështon.
        }
    }

    /** Gjendja e ruajtur: gjendja e JS-it, radha dhe ndryshimet me −/+. */
    private static final class State {

        final String sessionId;
        final long startedAt;
        final boolean complete;
        final JSONArray steps;
        final JSONObject texts;
        final JSONArray queue;
        final JSONObject adjust;
        private final String raw;

        private State(String raw, JSONObject state, JSONArray queue, JSONObject adjust) {
            this.raw = raw;
            this.sessionId = state.optString("sessionId");
            this.startedAt = state.optLong("startedAt");
            this.complete = state.optBoolean("complete", true);
            JSONArray steps = state.optJSONArray("steps");
            this.steps = steps == null ? new JSONArray() : steps;
            JSONObject texts = state.optJSONObject("texts");
            this.texts = texts == null ? new JSONObject() : texts;
            this.queue = queue;
            this.adjust = adjust;
        }

        @Nullable
        static State load(SharedPreferences prefs) {
            String raw = prefs.getString(KEY_STATE, null);
            JSONObject state = object(raw);
            if (state.optString("sessionId").isEmpty()) return null;
            return new State(raw, state, array(prefs.getString(KEY_QUEUE, null)), object(prefs.getString(KEY_ADJUST, null)));
        }

        void save(SharedPreferences prefs) {
            JSONArray queue = this.queue;
            if (queue.length() > MAX_QUEUE) {
                JSONArray recent = new JSONArray();
                for (int i = queue.length() - MAX_QUEUE; i < queue.length(); i++) recent.put(queue.opt(i));
                queue = recent;
            }
            prefs.edit().putString(KEY_STATE, raw).putString(KEY_QUEUE, queue.toString()).putString(KEY_ADJUST, adjust.toString()).commit();
        }

        /** Setet e kësaj seance që janë te radha (të ruajtura nga njoftimi, ende pa i marrë JS-i). */
        private Set<String> queuedKeys() {
            Set<String> keys = new HashSet<>();
            for (int i = 0; i < queue.length(); i++) {
                JSONObject action = queue.optJSONObject(i);
                if (action != null && "save".equals(action.optString("type"))) keys.add(action.optString("key"));
            }
            return keys;
        }

        /** Seti në njoftim: i pari që s'është ruajtur ende nga njoftimi; -1 kur s'mbetet asnjë. */
        int current() {
            Set<String> queued = queuedKeys();
            for (int i = 0; i < steps.length(); i++) {
                JSONObject step = steps.optJSONObject(i);
                if (step != null && !queued.contains(step.optString("key"))) return i;
            }
            return -1;
        }

        /**
         * Përsëritjet (ose sekondat) e setit: ndryshimi me −/+; përndryshe ato të setit para tij kur
         * ai u ruajt nga njoftimi me një vlerë tjetër (segmenti merr një të tretën, si te seanca,
         * program/next-set.ts); përndryshe propozimi i JS-it.
         */
        int count(int index) {
            JSONObject step = steps.optJSONObject(index);
            boolean timed = "timed".equals(step.optString("tracking"));
            String key = step.optString("key");
            if (adjust.has(key)) return adjust.optInt(key);
            JSONObject inherit = step.optJSONObject("inherit");
            if (inherit != null) {
                String from = inherit.optString("key");
                for (int i = queue.length() - 1; i >= 0; i--) {
                    JSONObject action = queue.optJSONObject(i);
                    if (action == null || !"save".equals(action.optString("type")) || !from.equals(action.optString("key"))) continue;
                    int saved = action.optInt(timed ? "seconds" : "reps");
                    int divisor = Math.max(1, inherit.optInt("divisor", 1));
                    return divisor == 1 ? saved : Math.max(1, Math.round(saved / (float) divisor));
                }
            }
            return step.optInt(timed ? "seconds" : "reps", 1);
        }
    }
}
