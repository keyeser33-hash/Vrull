package al.traininghub.app;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Nga cepi në cep, si në Android 15+; Capacitor (SystemBars) jep hapësirat e sigurta.
        // Thirret para super.onCreate, si te dokumentimi i Android-it. Dritarja krijohet këtu me
        // temën e nisjes, prandaj ajo deklaron vetë që nuk ka shirit veprimesh (styles.xml).
        EdgeToEdge.enable(this);
        // Plugin-et lokale regjistrohen para super.onCreate, ku krijohet ura me WebView-në.
        registerPlugin(WindowBackgroundPlugin.class);
        registerPlugin(BatteryPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
