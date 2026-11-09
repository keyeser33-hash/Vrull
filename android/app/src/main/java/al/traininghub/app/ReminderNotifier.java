package al.traininghub.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.service.notification.StatusBarNotification;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Rikujtuesit e zgjuar (V37, V2-E2-08). JS-i planifikon 7 ditët e ardhshme (reminders/plan.ts) dhe ia
 * jep listën plugin-it (RemindersPlugin); këtu ruhet te SharedPreferences ("vrull_reminders"), çdo
 * rikujtues merr alarmin e vet dhe, kur bie, njoftimin me butonat e tij ("Hëngra si në plan", "Shty
 * 30 min", "Piva një gotë", "E mora", "Po, sot"/"Jo, …"). Butonat janë PendingIntent broadcast të qarta
 * (si SessionActionReceiver), që punojnë me ekran të kyçur dhe kur procesi është vrarë: prekja ruhet
 * në radhë, njoftimi bëhet "… u regjistrua" me "Kthe mbrapsht", dhe JS-i e zbaton sapo jeton. "Shty
 * 30 min" e sjell njoftimin sërish pas 30 minutash pa hapur app-in. Ditari i njoftimeve të shfaqura
 * (u prekën apo jo) i duhet JS-it për heshtjen pas 3 ditëve të injoruara.
 */
final class ReminderNotifier {

    static final String ACTION_FIRE = "al.traininghub.app.reminder.FIRE";
    static final String ACTION_BUTTON = "al.traininghub.app.reminder.BUTTON";
    static final String ACTION_UNDO = "al.traininghub.app.reminder.UNDO";
    static final String ACTION_OPEN = "al.traininghub.app.reminder.OPEN";
    static final String EXTRA_ID = "id";
    static final String EXTRA_ACTION = "action";
    static final String EXTRA_TARGET = "target";
    static final String EXTRA_KEY = "vrull.key";

    /** Id-të e rikujtuesve (REMINDER_IDS te plan.ts) dhe të shtyrjeve. */
    static final int FIRST_ID = 5000;
    static final int LAST_ID = 5199;
    static final int FIRST_SNOOZE = 5200;
    static final int LAST_SNOOZE = 5299;
    private static final long SNOOZE_MS = 30 * 60_000L;
    /** Njoftimi "u regjistrua" ikën vetë pas 10 minutash. */
    private static final long DONE_TIMEOUT_MS = 10 * 60_000L;
    private static final long LOG_DAYS_MS = 14 * 24 * 3_600_000L;
    private static final int MAX_QUEUE = 200;
    private static final int MAX_LOG = 400;

    private static final String PREFS = "vrull_reminders";
    private static final String KEY_LIST = "list";
    private static final String KEY_SNOOZED = "snoozed";
    private static final String KEY_QUEUE = "queue";
    private static final String KEY_LOG = "log";
    private static final String KEY_CHANNEL = "channel";
    private static final String CHANNEL = "rikujtuesit";

    private static final Object LOCK = new Object();

    private ReminderNotifier() {}

    // ---- Planifikimi ----------------------------------------------------------------------

    /**
     * Lista e re zëvendëson të vjetrën: alarmet e saj hiqen, të rejat vendosen. Njoftimet e dukshme dhe
     * shtyrjet për `cancelKeys` (vakte, suplemente, ujë të regjistruar ndërkohë) hiqen.
     */
    static void schedule(Context context, JSONArray reminders, JSONObject channel, Set<String> cancelKeys) {
        synchronized (LOCK) {
            SharedPreferences prefs = prefs(context);
            JSONArray old = array(prefs.getString(KEY_LIST, null));
            for (int i = 0; i < old.length(); i++) {
                JSONObject item = old.optJSONObject(i);
                if (item != null) cancelAlarm(context, item.optInt("id"));
            }
            JSONObject snoozed = object(prefs.getString(KEY_SNOOZED, null));
            JSONObject keptSnoozed = new JSONObject();
            for (java.util.Iterator<String> it = snoozed.keys(); it.hasNext(); ) {
                String id = it.next();
                JSONObject item = snoozed.optJSONObject(id);
                if (item == null) continue;
                if (cancelKeys.contains(item.optString("key"))) cancelAlarm(context, Integer.parseInt(id));
                else putQuietly(keptSnoozed, id, item);
            }
            prefs
                .edit()
                .putString(KEY_LIST, reminders.toString())
                .putString(KEY_SNOOZED, keptSnoozed.toString())
                .putString(KEY_CHANNEL, channel.toString())
                .commit();
            long now = System.currentTimeMillis();
            for (int i = 0; i < reminders.length(); i++) {
                JSONObject item = reminders.optJSONObject(i);
                if (item != null && item.optLong("at") > now) setAlarm(context, item.optInt("id"), item.optLong("at"));
            }
        }
        ensureChannel(context);
        if (!cancelKeys.isEmpty()) cancelShown(context, cancelKeys);
    }

    /** Pas ndezjes së telefonit (ose përditësimit): alarmet e rikujtuesve që vijnë vendosen sërish. */
    static void restore(Context context) {
        synchronized (LOCK) {
            SharedPreferences prefs = prefs(context);
            long now = System.currentTimeMillis();
            JSONArray list = array(prefs.getString(KEY_LIST, null));
            for (int i = 0; i < list.length(); i++) {
                JSONObject item = list.optJSONObject(i);
                if (item != null && item.optLong("at") > now) setAlarm(context, item.optInt("id"), item.optLong("at"));
            }
            JSONObject snoozed = object(prefs.getString(KEY_SNOOZED, null));
            for (java.util.Iterator<String> it = snoozed.keys(); it.hasNext(); ) {
                String id = it.next();
                JSONObject item = snoozed.optJSONObject(id);
                if (item != null) setAlarm(context, Integer.parseInt(id), Math.max(now + 5_000L, item.optLong("at")));
            }
        }
    }

    // ---- Njoftimi -------------------------------------------------------------------------

    /** Alarmi i një rikujtuesi ose i një shtyrjeje: njoftimi me butonat. */
    static void fire(Context context, int id) {
        JSONObject item;
        synchronized (LOCK) {
            item = find(context, id);
            if (item == null) return;
            if (id >= FIRST_SNOOZE) {
                SharedPreferences prefs = prefs(context);
                JSONObject snoozed = object(prefs.getString(KEY_SNOOZED, null));
                snoozed.remove(String.valueOf(id));
                prefs.edit().putString(KEY_SNOOZED, snoozed.toString()).commit();
            }
            appendLog(context, item, false);
        }
        ensureChannel(context);
        notify(context, id, reminderNotification(context, id, item));
    }

    /** Një buton: shtyrja vendos alarmin pas 30 minutash; çdo tjetër hyn te radha dhe njoftimi thotë "u regjistrua". */
    static void onButton(Context context, int id, String action) {
        JSONObject item;
        String uid = UUID.randomUUID().toString();
        synchronized (LOCK) {
            item = find(context, id);
            if (item == null) {
                cancel(context, id);
                return;
            }
            markActed(context, item.optString("key"));
            if ("snooze".equals(action)) {
                int snoozeId = FIRST_SNOOZE + Math.floorMod(id, LAST_SNOOZE - FIRST_SNOOZE + 1);
                long at = System.currentTimeMillis() + SNOOZE_MS;
                SharedPreferences prefs = prefs(context);
                JSONObject snoozed = object(prefs.getString(KEY_SNOOZED, null));
                JSONObject copy = copy(item);
                putQuietly(copy, "id", snoozeId);
                putQuietly(copy, "at", at);
                putQuietly(snoozed, String.valueOf(snoozeId), copy);
                prefs.edit().putString(KEY_SNOOZED, snoozed.toString()).commit();
                setAlarm(context, snoozeId, at);
            } else {
                JSONObject entry = new JSONObject();
                putQuietly(entry, "id", uid);
                putQuietly(entry, "action", action);
                putQuietly(entry, "key", item.optString("key"));
                putQuietly(entry, "data", item.opt("data") == null ? JSONObject.NULL : item.opt("data"));
                putQuietly(entry, "at", System.currentTimeMillis());
                enqueue(context, entry);
            }
        }
        if ("snooze".equals(action)) {
            cancel(context, id);
        } else {
            notify(context, id, doneNotification(context, id, item, action, uid));
            RemindersPlugin.emitAction();
        }
    }

    /** "Kthe mbrapsht": prekja që JS-i nuk e ka zbatuar ende hiqet nga radha; përndryshe JS-i e kthen. */
    static void onUndo(Context context, int id, String target) {
        synchronized (LOCK) {
            SharedPreferences prefs = prefs(context);
            JSONArray queue = array(prefs.getString(KEY_QUEUE, null));
            JSONArray kept = new JSONArray();
            boolean removed = false;
            for (int i = 0; i < queue.length(); i++) {
                JSONObject entry = queue.optJSONObject(i);
                if (entry == null) continue;
                if (target.equals(entry.optString("id"))) removed = true;
                else kept.put(entry);
            }
            if (removed) {
                prefs.edit().putString(KEY_QUEUE, kept.toString()).commit();
            } else {
                JSONObject undo = new JSONObject();
                putQuietly(undo, "id", UUID.randomUUID().toString());
                putQuietly(undo, "action", "undo");
                putQuietly(undo, "target", target);
                JSONObject item = find(context, id);
                putQuietly(undo, "key", item == null ? "" : item.optString("key"));
                putQuietly(undo, "data", JSONObject.NULL);
                putQuietly(undo, "at", System.currentTimeMillis());
                enqueue(context, undo);
            }
        }
        cancel(context, id);
        RemindersPlugin.emitAction();
    }

    private static Notification reminderNotification(Context context, int id, JSONObject item) {
        NotificationCompat.Builder builder = base(context, item)
            .setContentTitle(item.optString("title"))
            .setContentText(item.optString("body"))
            .setStyle(new NotificationCompat.BigTextStyle().bigText(item.optString("body")))
            .setWhen(item.optLong("at", System.currentTimeMillis()))
            .setShowWhen(true);
        JSONArray actions = item.optJSONArray("actions");
        for (int i = 0; actions != null && i < actions.length() && i < 3; i++) {
            JSONObject action = actions.optJSONObject(i);
            if (action == null) continue;
            builder.addAction(0, action.optString("title"), buttonIntent(context, id, action.optString("id"), i));
        }
        return builder.build();
    }

    private static Notification doneNotification(Context context, int id, JSONObject item, String action, String uid) {
        JSONObject done = item.optJSONObject("done");
        JSONObject texts = done == null ? null : done.optJSONObject(action);
        String title = texts == null ? item.optString("title") : texts.optString("title");
        String body = texts == null ? "" : texts.optString("body");
        NotificationCompat.Builder builder = base(context, item)
            .setContentTitle(title)
            .setContentText(body)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setTimeoutAfter(DONE_TIMEOUT_MS);
        // Vetëm regjistrimet kthehen mbrapsht; "Po"/"Jo" ndryshohen te app-i.
        if ("ate".equals(action) || "took".equals(action) || "drank".equals(action)) {
            builder.addAction(0, item.optString("undo"), undoIntent(context, id, uid));
        }
        return builder.build();
    }

    private static NotificationCompat.Builder base(Context context, JSONObject item) {
        Bundle extras = new Bundle();
        extras.putString(EXTRA_KEY, item.optString("key"));
        return new NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_pushimi)
            .setColor(ContextCompat.getColor(context, R.color.notification_ember))
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .addExtras(extras)
            .setContentIntent(openIntent(context, item));
    }

    // ---- Radha dhe ditari, për JS-in --------------------------------------------------------

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
                JSONObject entry = queue.optJSONObject(i);
                if (entry != null && !ids.contains(entry.optString("id"))) kept.put(entry);
            }
            prefs.edit().putString(KEY_QUEUE, kept.toString()).commit();
        }
    }

    static JSONArray log(Context context) {
        synchronized (LOCK) {
            return array(prefs(context).getString(KEY_LOG, null));
        }
    }

    /** Hapja e app-it nga njoftimi: lloji nuk është injoruar. */
    static void markActed(Context context, String key) {
        if (key == null || key.isEmpty()) return;
        synchronized (LOCK) {
            SharedPreferences prefs = prefs(context);
            JSONArray log = array(prefs.getString(KEY_LOG, null));
            for (int i = 0; i < log.length(); i++) {
                JSONObject entry = log.optJSONObject(i);
                if (entry != null && key.equals(entry.optString("key"))) putQuietly(entry, "acted", true);
            }
            prefs.edit().putString(KEY_LOG, log.toString()).commit();
        }
    }

    private static void appendLog(Context context, JSONObject item, boolean acted) {
        SharedPreferences prefs = prefs(context);
        JSONArray log = array(prefs.getString(KEY_LOG, null));
        long cutoff = System.currentTimeMillis() - LOG_DAYS_MS;
        JSONArray kept = new JSONArray();
        for (int i = 0; i < log.length(); i++) {
            JSONObject entry = log.optJSONObject(i);
            if (entry == null || entry.optLong("shownAt") < cutoff) continue;
            // Një njoftim i shtyrë që vjen sërish mbetet "i prekur" (shtyrja është prekje).
            if (item.optString("key").equals(entry.optString("key"))) acted = acted || entry.optBoolean("acted");
            else kept.put(entry);
        }
        JSONObject data = item.optJSONObject("data");
        JSONObject entry = new JSONObject();
        putQuietly(entry, "key", item.optString("key"));
        putQuietly(entry, "kind", item.optString("kind"));
        putQuietly(entry, "date", data == null ? "" : data.optString("date"));
        putQuietly(entry, "shownAt", System.currentTimeMillis());
        putQuietly(entry, "acted", acted);
        kept.put(entry);
        while (kept.length() > MAX_LOG) kept.remove(0);
        prefs.edit().putString(KEY_LOG, kept.toString()).commit();
    }

    private static void enqueue(Context context, JSONObject entry) {
        SharedPreferences prefs = prefs(context);
        JSONArray queue = array(prefs.getString(KEY_QUEUE, null));
        queue.put(entry);
        while (queue.length() > MAX_QUEUE) queue.remove(0);
        prefs.edit().putString(KEY_QUEUE, queue.toString()).commit();
    }

    // ---- Ndihmës ----------------------------------------------------------------------------

    @Nullable
    private static JSONObject find(Context context, int id) {
        SharedPreferences prefs = prefs(context);
        if (id >= FIRST_SNOOZE) return object(prefs.getString(KEY_SNOOZED, null)).optJSONObject(String.valueOf(id));
        JSONArray list = array(prefs.getString(KEY_LIST, null));
        for (int i = 0; i < list.length(); i++) {
            JSONObject item = list.optJSONObject(i);
            if (item != null && item.optInt("id") == id) return item;
        }
        return null;
    }

    private static void cancelShown(Context context, Set<String> keys) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        Set<Integer> ids = new HashSet<>();
        for (StatusBarNotification shown : manager.getActiveNotifications()) {
            String key = shown.getNotification().extras.getString(EXTRA_KEY);
            if (key != null && keys.contains(key)) ids.add(shown.getId());
        }
        for (int id : ids) manager.cancel(id);
    }

    static void cancel(Context context, int id) {
        NotificationManagerCompat.from(context).cancel(id);
    }

    @SuppressLint("MissingPermission")
    private static void notify(Context context, int id, Notification notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        try {
            NotificationManagerCompat.from(context).notify(id, notification);
        } catch (SecurityException ignored) {
            // Leja u hoq ndërkohë.
        }
    }

    private static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        JSONObject texts = object(prefs(context).getString(KEY_CHANNEL, null));
        // E njëjta id dhe rëndësi si kanali i v1 (lib/reminders-native.ts): Android-i përditëson vetëm emrin.
        NotificationChannel channel = new NotificationChannel(CHANNEL, texts.optString("name", "Vrull"), NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription(texts.optString("description"));
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(channel);
    }

    private static PendingIntent fireIntent(Context context, int id) {
        Intent intent = new Intent(context, ReminderReceiver.class).setAction(ACTION_FIRE).putExtra(EXTRA_ID, id);
        intent.setData(new Uri.Builder().scheme("vrull-reminder").authority("fire").appendPath(String.valueOf(id)).build());
        return PendingIntent.getBroadcast(context, id, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static PendingIntent buttonIntent(Context context, int id, String action, int index) {
        Intent intent = new Intent(context, ReminderReceiver.class).setAction(ACTION_BUTTON).putExtra(EXTRA_ID, id).putExtra(EXTRA_ACTION, action);
        intent.setData(new Uri.Builder().scheme("vrull-reminder").authority("button").appendPath(String.valueOf(id)).appendPath(action).build());
        return PendingIntent.getBroadcast(context, id * 10 + index, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static PendingIntent undoIntent(Context context, int id, String uid) {
        Intent intent = new Intent(context, ReminderReceiver.class).setAction(ACTION_UNDO).putExtra(EXTRA_ID, id).putExtra(EXTRA_TARGET, uid);
        intent.setData(new Uri.Builder().scheme("vrull-reminder").authority("undo").appendPath(String.valueOf(id)).appendPath(uid).build());
        return PendingIntent.getBroadcast(context, id * 10 + 9, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Prekja e njoftimit hap app-in; RemindersPlugin e shënon si të prekur. */
    private static PendingIntent openIntent(Context context, JSONObject item) {
        Intent intent = new Intent(context, MainActivity.class)
            .setAction(ACTION_OPEN)
            .putExtra(EXTRA_KEY, item.optString("key"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.setData(new Uri.Builder().scheme("vrull-reminder").authority("open").appendPath(String.valueOf(item.optInt("id"))).build());
        return PendingIntent.getActivity(context, item.optInt("id"), intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Alarm i saktë kur lejohet, përndryshe sa më afër (si alarmi i pushimit te SessionNotifier). */
    @SuppressLint("MissingPermission")
    private static void setAlarm(Context context, int id, long at) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        if (alarms == null) return;
        PendingIntent intent = fireIntent(context, id);
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

    private static void cancelAlarm(Context context, int id) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        if (alarms != null) alarms.cancel(fireIntent(context, id));
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static JSONArray array(@Nullable String text) {
        if (text == null) return new JSONArray();
        try {
            return new JSONArray(text);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static JSONObject object(@Nullable String text) {
        if (text == null) return new JSONObject();
        try {
            return new JSONObject(text);
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    private static JSONObject copy(JSONObject source) {
        return object(source.toString());
    }

    private static void putQuietly(JSONObject target, String key, Object value) {
        try {
            target.put(key, value);
        } catch (JSONException ignored) {
            // Çelësi është gjithnjë tekst jo bosh.
        }
    }
}
