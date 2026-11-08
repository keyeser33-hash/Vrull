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
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Ura e njoftimit të seancës me JS-in (V2-E1-08; lib/session-notification-native.ts). Gjendja,
 * radha dhe pushimi jetojnë te SessionNotifier, që punon edhe pa këtë plugin (pa WebView); plugin-i
 * vetëm i përcjell dhe i thotë JS-it kur ka një prekje të re ("action") ose një "Ndrysho" ("open").
 */
@CapacitorPlugin(name = "SessionNotification")
public class SessionNotificationPlugin extends Plugin {

    @Nullable
    private static volatile SessionNotificationPlugin instance;
    @Nullable
    private JSObject openRequest;

    @Override
    public void load() {
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
    }

    /** Një prekje u shtua te radha: kur JS-i jeton, e zbaton menjëherë (përndryshe në nisjen e radhës). */
    static void emitAction() {
        SessionNotificationPlugin plugin = instance;
        if (plugin != null) plugin.notifyListeners("action", new JSObject());
    }

    @PluginMethod
    public void show(PluginCall call) {
        JSObject state = call.getObject("state");
        if (state == null || state.optString("sessionId").isEmpty()) {
            call.reject("Mungon gjendja e seancës", "INVALID");
            return;
        }
        SessionNotifier.show(getContext(), state);
        call.resolve();
    }

    @PluginMethod
    public void hide(PluginCall call) {
        SessionNotifier.hide(getContext());
        call.resolve();
    }

    @PluginMethod
    public void pending(PluginCall call) {
        try {
            JSObject result = new JSObject();
            result.put("actions", new JSArray(SessionNotifier.pending(getContext()).toString()));
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
        SessionNotifier.ack(getContext(), values);
        call.resolve();
    }

    /** Pushimi i nisur te app-i (lib/rest-alarm.ts): alarmi i saktë dhe njoftimi "Pushimi". */
    @PluginMethod
    public void scheduleRest(PluginCall call) {
        Long at = CallNumbers.longOf(call, "at");
        if (at == null) {
            call.reject("Mungon fundi i pushimit", "INVALID");
            return;
        }
        SessionNotifier.startRest(
            getContext(),
            at,
            call.getString("title", ""),
            call.getString("body", ""),
            call.getString("channel", ""),
            call.getString("channelText", "")
        );
        call.resolve();
    }

    @PluginMethod
    public void cancelRest(PluginCall call) {
        SessionNotifier.cancelRest(getContext());
        call.resolve();
    }

    /** "Ndrysho" i fundit, një herë: JS-i hap seancën te seti. */
    @PluginMethod
    public void consumeOpen(PluginCall call) {
        JSObject result = new JSObject();
        synchronized (this) {
            result.put("request", openRequest == null ? JSONObject.NULL : openRequest);
            openRequest = null;
        }
        call.resolve(result);
    }

    /** Edhe intent-i i nisjes vjen këtu (BridgeActivity.load). */
    @Override
    protected void handleOnNewIntent(Intent intent) {
        if (!SessionNotifier.ACTION_OPEN.equals(intent.getAction())) return;
        JSObject request = new JSObject();
        request.put("sessionId", intent.getStringExtra("sessionId"));
        request.put("slotId", intent.hasExtra("slotId") ? intent.getStringExtra("slotId") : JSONObject.NULL);
        request.put("setNumber", intent.getIntExtra("setNumber", 0));
        request.put("segment", intent.getBooleanExtra("segment", false));
        request.put("reps", intent.hasExtra("reps") ? intent.getIntExtra("reps", 0) : JSONObject.NULL);
        request.put("seconds", intent.hasExtra("seconds") ? intent.getIntExtra("seconds", 0) : JSONObject.NULL);
        synchronized (this) {
            openRequest = request;
        }
        // Një rikrijim i aktivitetit (p.sh. rrotullimi) nuk e hap seancën përsëri.
        intent.setAction(Intent.ACTION_MAIN);
        notifyListeners("open", new JSObject());
    }
}
