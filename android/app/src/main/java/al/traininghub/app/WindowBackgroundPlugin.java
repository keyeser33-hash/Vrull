package al.traininghub.app;

import android.graphics.Color;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Ngjyra e dritarës pas shiritave të sistemit. Në WebView para versionit 140, Capacitor e vendos
 * faqen poshtë orës dhe mbi shiritin e navigimit, dhe në ato rripa duket dritarja. Tema e app-it
 * (src/lib/theme.ts) i dërgon këtu sfondin e saj, që rripat të mos mbeten të zinj në temën e çelët.
 */
@CapacitorPlugin(name = "WindowBackground")
public class WindowBackgroundPlugin extends Plugin {

    @PluginMethod
    public void setColor(PluginCall call) {
        String value = call.getString("color");
        final int color;
        try {
            color = Color.parseColor(value);
        } catch (IllegalArgumentException | NullPointerException e) {
            call.reject("Ngjyrë e pavlefshme: " + value);
            return;
        }
        getActivity().runOnUiThread(() -> {
            getActivity().getWindow().getDecorView().setBackgroundColor(color);
            call.resolve();
        });
    }
}
