package al.traininghub.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.annotation.RequiresApi;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * "Ruaj në galeri" për kartën e javës (V43, SPEC §0.3c; lib/gallery-native.ts): PNG-ja ruhet te
 * Pictures/Vrull. Android 10+ (API 29) me MediaStore, pa leje; Android 7–9 (minSdk 24) me lejen
 * WRITE_EXTERNAL_STORAGE (deklaruar vetëm deri te API 28), që kërkohet herën e parë, dhe skedari i
 * jepet galerisë me MediaScannerConnection.
 */
@CapacitorPlugin(name = "Gallery", permissions = { @Permission(strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }, alias = GalleryPlugin.STORAGE) })
public class GalleryPlugin extends Plugin {

    static final String STORAGE = "storage";
    private static final String FOLDER = "Vrull";
    private static final String NAME = "[A-Za-z0-9._-]{1,80}\\.png";
    private final ExecutorService worker = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void saveImage(PluginCall call) {
        String data = call.getString("data");
        String name = call.getString("name");
        if (data == null || data.isEmpty() || name == null || !name.matches(NAME)) {
            call.reject("Mungon karta ose emri", "INVALID");
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && getPermissionState(STORAGE) != PermissionState.GRANTED) {
            requestPermissionForAlias(STORAGE, call, "storageResult");
            return;
        }
        save(call);
    }

    @PermissionCallback
    private void storageResult(PluginCall call) {
        if (getPermissionState(STORAGE) == PermissionState.GRANTED) {
            save(call);
            return;
        }
        JSObject result = new JSObject();
        result.put("saved", false);
        result.put("denied", true);
        call.resolve(result);
    }

    private void save(PluginCall call) {
        String data = call.getString("data");
        String name = call.getString("name");
        worker.execute(() -> {
            try {
                byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) saveWithMediaStore(bytes, name);
                else saveToPictures(bytes, name);
                JSObject result = new JSObject();
                result.put("saved", true);
                call.resolve(result);
            } catch (IOException | IllegalArgumentException | SecurityException e) {
                call.reject("Karta nuk u ruajt", "SAVE", e);
            }
        });
    }

    @RequiresApi(api = Build.VERSION_CODES.Q)
    private void saveWithMediaStore(byte[] bytes, String name) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, name);
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/" + FOLDER);
        values.put(MediaStore.Images.Media.IS_PENDING, 1);
        Uri uri = resolver.insert(MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY), values);
        if (uri == null) throw new IOException("MediaStore nuk e krijoi skedarin");
        try (OutputStream out = resolver.openOutputStream(uri)) {
            if (out == null) throw new IOException("MediaStore nuk e hapi skedarin");
            out.write(bytes);
        } catch (IOException e) {
            resolver.delete(uri, null, null);
            throw e;
        }
        // Galeria e sheh skedarin vetëm kur nuk është më "në pritje".
        values.clear();
        values.put(MediaStore.Images.Media.IS_PENDING, 0);
        resolver.update(uri, values, null, null);
    }

    @SuppressWarnings("deprecation")
    private void saveToPictures(byte[] bytes, String name) throws IOException {
        File folder = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), FOLDER);
        if (!folder.isDirectory() && !folder.mkdirs()) throw new IOException("Dosja Pictures/Vrull nuk u krijua");
        File file = new File(folder, name);
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(bytes);
        }
        MediaScannerConnection.scanFile(getContext(), new String[] { file.getAbsolutePath() }, new String[] { "image/png" }, null);
    }
}
