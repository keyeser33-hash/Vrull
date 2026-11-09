package al.traininghub.app;

import android.content.Intent;
import androidx.annotation.Nullable;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Ura e rikujtuesve të zgjuar me JS-in (V37, V2-E2-08; lib/reminders-native.ts). Planifikimi, alarmet,
 * butonat dhe radha jetojnë te ReminderNotifier, që punon edhe pa këtë plugin; plugin-i i përcjell dhe
 * i thotë JS-it kur ka një prekje të re ("action").
 */
@CapacitorPlugin(name = "Reminders")
public class RemindersPlugin extends Plugin {

    @Nullable
    private static volatile RemindersPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
    }

    static void emitAction() {
        RemindersPlugin plugin = instance;
        if (plugin != null) plugin.notifyListeners("action", new JSObject());
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        JSArray reminders = call.getArray("reminders");
        JSObject channel = call.getObject("channel", new JSObject());
        JSArray cancelKeys = call.getArray("cancelKeys");
        if (reminders == null) {
            call.reject("Mungon lista e rikujtuesve", "INVALID");
            return;
        }
        Set<String> keys = new HashSet<>();
        for (int i = 0; cancelKeys != null && i < cancelKeys.length(); i++) keys.add(cancelKeys.optString(i));
        try {
            ReminderNotifier.schedule(getContext(), new JSONArray(reminders.toString()), channel == null ? new JSONObject() : channel, keys);
        } catch (JSONException e) {
            call.reject("Lista e rikujtuesve nuk u lexua", "INVALID");
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void pending(PluginCall call) {
        try {
            JSObject result = new JSObject();
            result.put("actions", new JSArray(ReminderNotifier.pending(getContext()).toString()));
            call.resolve(result);
        } catch (JSONException e) {
            call.reject("Radha nuk u lexua", "QUEUE");
        }
    }

    @PluginMethod
    public void ack(PluginCall call) {
        JSArray ids = call.getArray("ids");
        Set<String> values = new HashSet<>();
        for (int i = 0; ids != null && i < ids.length(); i++) values.add(ids.optString(i));
        ReminderNotifier.ack(getContext(), values);
        call.resolve();
    }

    @PluginMethod
    public void log(PluginCall call) {
        try {
            JSObject result = new JSObject();
            result.put("entries", new JSArray(ReminderNotifier.log(getContext()).toString()));
            call.resolve(result);
        } catch (JSONException e) {
            call.reject("Ditari nuk u lexua", "LOG");
        }
    }

    /** Hapja nga njoftimi (edhe intent-i i nisjes vjen këtu): rikujtuesi u prek. */
    @Override
    protected void handleOnNewIntent(Intent intent) {
        if (!ReminderNotifier.ACTION_OPEN.equals(intent.getAction())) return;
        ReminderNotifier.markActed(getContext(), intent.getStringExtra(ReminderNotifier.EXTRA_KEY));
        intent.setAction(Intent.ACTION_MAIN);
    }
}
