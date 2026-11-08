package al.traininghub.musictest;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

/** Nis "luajtjen" (shërbimin me sesionin e medias) dhe mbyllet; prova kthehet te Vrull. */
public class MainActivity extends Activity {

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        startForegroundService(new Intent(this, PlayerService.class));
        finish();
    }
}
