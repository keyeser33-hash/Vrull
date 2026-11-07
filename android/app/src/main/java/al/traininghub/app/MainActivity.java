package al.traininghub.app;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // BridgeActivity vendos temën pa shirit veprimesh brenda super.onCreate. EdgeToEdge
        // e krijon dritaren, prandaj thirret pas saj: para saj, dritarja do të merrte
        // temën e nisjes dhe një shirit me titullin e app-it sipër faqes.
        super.onCreate(savedInstanceState);
        // Nga cepi në cep, si në Android 15+; Capacitor (SystemBars) jep hapësirat e sigurta.
        EdgeToEdge.enable(this);
    }
}
