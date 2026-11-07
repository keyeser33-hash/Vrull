package al.traininghub.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Përjashtimi nga optimizimi i baterisë (SPEC §18, TH-09). Disa prodhues (Samsung, Xiaomi) e
 * vonojnë njoftimin e timer-it me ekran të kyçur edhe me alarm të saktë; me përjashtimin, jo.
 * Përdoruesi e lejon vetë në dritaren e sistemit që hap kjo metodë.
 */
@CapacitorPlugin(name = "Battery")
public class BatteryPlugin extends Plugin {

    @PluginMethod
    public void isIgnoringOptimizations(PluginCall call) {
        PowerManager power = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        JSObject result = new JSObject();
        result.put("value", power != null && power.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        call.resolve(result);
    }

    @PluginMethod
    public void requestIgnoreOptimizations(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
        } catch (RuntimeException e) {
            // Disa sisteme nuk e kanë këtë dritare: hapet lista e optimizimit të baterisë.
            Intent list = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            list.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(list);
        }
        call.resolve();
    }
}
