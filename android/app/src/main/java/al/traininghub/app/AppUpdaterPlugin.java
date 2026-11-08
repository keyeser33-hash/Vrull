package al.traininghub.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Përditësimi brenda app-it (SPEC §3b, TH-23): shkarkon APK-në e re nga lidhja e firmosur e
 * Supabase-it, verifikon SHA-256 dhe e instalon me PackageInstaller. Android-i e lejon një app të
 * përditësojë veten pa dritare konfirmimi (Android 12+) kur ka REQUEST_INSTALL_PACKAGES, lejen
 * "Instalo app të panjohura" dhe deklaron UPDATE_PACKAGES_WITHOUT_USER_ACTION; përndryshe del
 * dritarja e sistemit (AppUpdateReceiver). Android-i pranon vetëm APK me të njëjtin çelës nënshkrimi.
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    static final String ACTION_STATUS = "al.traininghub.app.UPDATE_STATUS";
    private static final String FILE_NAME = "perditesimi.apk";
    private static final String PREFS = "vrull";
    private static final String KEY_LANGUAGE = "language";
    private static AppUpdaterPlugin instance;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();

    @Override
    public void load() {
        instance = this;
    }

    /** Thirret nga AppUpdateReceiver: dritarja e sistemit u hap, ose instalimi dështoi. */
    static void report(String status, boolean aborted, String message) {
        AppUpdaterPlugin plugin = instance;
        if (plugin == null) return;
        JSObject event = new JSObject();
        event.put("status", status);
        event.put("aborted", aborted);
        event.put("message", message);
        plugin.notifyListeners("installStatus", event);
    }

    /**
     * Gjuha e app-it ("sq" ose "en"), që app-i e dërgon në nisje dhe kur ndërrohet
     * (lib/native-language.ts). AppReplacedReceiver e lexon për njoftimin pas përditësimit.
     */
    @PluginMethod
    public void setLanguage(PluginCall call) {
        String language = call.getString("language");
        if (!"sq".equals(language) && !"en".equals(language)) {
            call.reject("Gjuhë e panjohur", "INVALID");
            return;
        }
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_LANGUAGE, language).apply();
        call.resolve();
    }

    /** Gjuha e fundit e app-it; shqip kur app-i s'e ka dërguar ende (p.sh. pas përditësimit nga v1). */
    static String language(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_LANGUAGE, "sq");
    }

    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject result = new JSObject();
        result.put("value", getContext().getPackageManager().canRequestPackageInstalls());
        call.resolve(result);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url");
        String sha256 = call.getString("sha256");
        if (url == null || !url.startsWith("https://") || sha256 == null) {
            call.reject("Lidhje ose SHA-256 e pavlefshme", "INVALID");
            return;
        }
        worker.execute(() -> {
            File file = cachedApk(getContext());
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setConnectTimeout(20_000);
                connection.setReadTimeout(30_000);
                if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                    throw new IOException("HTTP " + connection.getResponseCode());
                }
                long total = connection.getContentLengthLong();
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                long[] lastReport = { 0 };
                try (InputStream in = connection.getInputStream(); OutputStream out = new FileOutputStream(file)) {
                    copy(in, out, digest, (done) -> {
                        long now = System.currentTimeMillis();
                        if (now - lastReport[0] < 150) return;
                        lastReport[0] = now;
                        JSObject progress = new JSObject();
                        progress.put("bytes", done);
                        progress.put("total", total);
                        notifyListeners("downloadProgress", progress);
                    });
                }
                if (!matches(digest, sha256)) {
                    file.delete();
                    call.reject("Skedari nuk përputhet me SHA-256 e versionit", "HASH_MISMATCH");
                    return;
                }
                JSObject result = new JSObject();
                result.put("path", file.getAbsolutePath());
                call.resolve(result);
            } catch (Exception e) {
                file.delete();
                call.reject("Shkarkimi nuk u krye: " + e.getMessage(), "DOWNLOAD");
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    @PluginMethod
    public void install(PluginCall call) {
        String path = call.getString("path");
        String sha256 = call.getString("sha256");
        if (path == null || sha256 == null) {
            call.reject("Mungon skedari ose SHA-256", "INVALID");
            return;
        }
        worker.execute(() -> {
            File file = new File(path.startsWith("file://") ? Uri.parse(path).getPath() : path);
            if (!file.isFile()) {
                call.reject("Skedari i përditësimit mungon", "MISSING");
                return;
            }
            PackageInstaller installer = getContext().getPackageManager().getPackageInstaller();
            int id = -1;
            try {
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                try (InputStream in = new FileInputStream(file)) {
                    copy(in, null, digest, null);
                }
                if (!matches(digest, sha256)) {
                    call.reject("Skedari nuk përputhet me SHA-256 e versionit", "HASH_MISMATCH");
                    return;
                }
                PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
                params.setAppPackageName(getContext().getPackageName());
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
                }
                id = installer.createSession(params);
                try (PackageInstaller.Session session = installer.openSession(id)) {
                    try (InputStream in = new FileInputStream(file); OutputStream out = session.openWrite("base.apk", 0, file.length())) {
                        copy(in, out, null, null);
                        session.fsync(out);
                    }
                    Intent status = new Intent(getContext(), AppUpdateReceiver.class).setAction(ACTION_STATUS);
                    int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0);
                    session.commit(PendingIntent.getBroadcast(getContext(), id, status, flags).getIntentSender());
                }
                call.resolve();
            } catch (Exception e) {
                // Një seancë e nisur por e pambyllur mban kopjen e APK-së; lirohet menjëherë.
                if (id != -1) {
                    try {
                        installer.abandonSession(id);
                    } catch (RuntimeException ignored) {
                        // Seanca mund të jetë mbyllur tashmë.
                    }
                }
                call.reject("Instalimi nuk nisi: " + e.getMessage(), "INSTALL");
            }
        });
    }

    /** APK-ja e shkarkuar, që AppReplacedReceiver e fshin pas përditësimit. */
    static File cachedApk(Context context) {
        return new File(context.getCacheDir(), FILE_NAME);
    }

    private interface Progress {
        void done(long bytes);
    }

    /** Kopjon `in` te `out` (kur ka), duke e futur çdo copë te `digest` (kur ka) dhe duke raportuar përparimin. */
    private static void copy(InputStream in, OutputStream out, MessageDigest digest, Progress progress) throws IOException {
        byte[] buffer = new byte[64 * 1024];
        long done = 0;
        int read;
        while ((read = in.read(buffer)) != -1) {
            if (out != null) out.write(buffer, 0, read);
            if (digest != null) digest.update(buffer, 0, read);
            done += read;
            if (progress != null) progress.done(done);
        }
    }

    private static boolean matches(MessageDigest digest, String sha256) {
        return hex(digest.digest()).equals(sha256.toLowerCase(Locale.ROOT));
    }

    private static String hex(byte[] bytes) {
        StringBuilder out = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) out.append(String.format(Locale.ROOT, "%02x", value));
        return out.toString();
    }
}
