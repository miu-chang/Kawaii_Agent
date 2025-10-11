import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.miuchang.kawaiiagent',
  appName: 'Kawaii Agent',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Haptics: {
      // ハプティクス設定
    },
    Motion: {
      // モーションセンサー設定
    },
    Camera: {
      // カメラ設定
    },
    Share: {
      // 共有設定
    }
  }
};

export default config;
