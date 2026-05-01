import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gptimage.app',
  appName: 'GPT Image',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    StatusBar: {
      backgroundColor: '#ffffff',
      style: 'LIGHT',
      overlaysWebView: false,
    },
  },
  server: {
    allowNavigation: [
      'dm-fox.rjj.cc',
      'api.apimart.ai',
    ],
  },
};

export default config;
