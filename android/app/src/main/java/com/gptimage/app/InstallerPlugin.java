package com.gptimage.app;

import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

@CapacitorPlugin(name = "Installer")
public class InstallerPlugin extends Plugin {

    @PluginMethod
    public void installApk(PluginCall call) {
        String filePath = call.getString("filePath");
        if (filePath == null || filePath.isEmpty()) {
            call.reject("filePath is required");
            return;
        }

        try {
            // 处理 file:// 前缀
            String path = filePath;
            if (path.startsWith("file://")) {
                path = path.substring(7);
            }
            File file = new File(path);
            if (!file.exists()) {
                call.reject("APK file not found: " + path);
                return;
            }

            android.util.Log.d("InstallerPlugin", "Installing APK: " + file.getAbsolutePath() + " size=" + file.length());

            String authority = getContext().getPackageName() + ".fileprovider";
            Uri uri = FileProvider.getUriForFile(getContext(), authority, file);

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            call.resolve();
        } catch (Exception e) {
            android.util.Log.e("InstallerPlugin", "Install failed", e);
            call.reject("Install failed: " + e.getMessage(), e);
        }
    }
}
