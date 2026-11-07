package al.traininghub.app;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Nga cepi në cep, si në Android 15+; Capacitor (SystemBars) jep hapësirat e sigurta.
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
    }
}
