import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gptimage.app',
  appName: 'GPT Image',
  webDir: 'dist',
  server: {
    allowNavigation: [
      'dm-fox.rjj.cc',
      'api.apimart.ai',
    ],
  },
};

export default config;
