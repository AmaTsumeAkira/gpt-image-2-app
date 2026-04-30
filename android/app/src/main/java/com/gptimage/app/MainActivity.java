package com.gptimage.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    public MainActivity() {
        addPlugin(GallerySaverPlugin.class);
    }
}
