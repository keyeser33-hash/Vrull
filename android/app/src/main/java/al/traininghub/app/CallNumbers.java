package al.traininghub.app;

import androidx.annotation.Nullable;
import com.getcapacitor.PluginCall;

/**
 * Numrat që vijnë nga JS-i (V2-E1-16a). org.json i lexon numrat e plotë si Integer ose Long sipas
 * madhësisë, ndërsa PluginCall.getLong pranon vetëm Long dhe getDouble vetëm Double, Float ose Integer:
 * një kohë në ms (1 794 152 612 211, Long) dilte null te getDouble, dhe një pozicion i këngës (30 000,
 * Integer) null te getLong. Prova në emulator e kapi: "Pushimi mbaroi" i pushimit të nisur te app-i nuk
 * planifikohej. Këtu çdo numër pranohet.
 */
final class CallNumbers {

    private CallNumbers() {}

    @Nullable
    static Long longOf(PluginCall call, String name) {
        Object value = call.getData().opt(name);
        return value instanceof Number ? ((Number) value).longValue() : null;
    }
}
