# デスクトップメイトAI - スマホアプリ移植ガイド

## 概要

desktop-mate-aiをReact Nativeベースのスマホアプリに移植するための完全ガイド。
コアロジックの70-80%は再利用可能。

---

## 推奨技術スタック

### フレームワーク
```json
{
  "core": "React Native + Expo",
  "3d": "expo-gl + expo-three",
  "vrm": "@pixiv/three-vrm (そのまま使用可)",
  "audio": "expo-av (再生) + expo-speech (TTS)",
  "voice": "expo-speech-recognition or @react-native-voice/voice",
  "ai": "OpenAI API (そのまま使用可)"
}
```

### 必要なパッケージ
```bash
npx create-expo-app desktop-mate-mobile
cd desktop-mate-mobile

# 3D関連
expo install expo-gl expo-three

# 音声関連
expo install expo-av expo-speech
npm install @react-native-voice/voice

# その他
npm install @pixiv/three-vrm three@0.170.0
npm install openai
npm install @react-native-async-storage/async-storage
npm install expo-file-system
```

---

## 移植マトリックス

### ✅ そのまま使える部分 (70-80%)

| コンポーネント | ファイル | 移植難易度 | 備考 |
|--------------|---------|----------|------|
| **AI会話** | `src/services/aiService.js` | ⭐ 簡単 | OpenAI APIそのまま |
| **Moe TTS** | `src/services/moeTTSService.js` | ⭐ 簡単 | Fetch APIそのまま |
| **Uma TTS** | `src/services/umaVoiceService.js` | ⭐ 簡単 | Fetch APIそのまま |
| **モーション管理** | `src/services/localMotionAI.js` | ⭐⭐ 中程度 | ロジックは同じ |
| **VRMローダー** | `src/utils/vrmaLoader.js` | ⭐⭐ 中程度 | Three.jsベースなのでOK |
| **VRMジェスチャー** | `src/utils/vrmGestures.js` | ⭐ 簡単 | 計算ロジックのみ |
| **ツール定義** | `src/services/tools.js` | ⭐⭐ 中程度 | 一部API変更必要 |

### ❌ 変更が必要な部分

| コンポーネント | 現在の実装 | スマホでの代替 |
|--------------|-----------|--------------|
| **Electronウィンドウ** | `src/main.js` | React Nativeのルーティング |
| **透明ウィンドウ** | Electron透過 | フローティングウィジェット（Android） |
| **常に最前面** | `alwaysOnTop` | SYSTEM_ALERT_WINDOW権限（Android）<br>iOS非対応 |
| **音声録音** | `src/services/voiceRecorder.js` | expo-av or react-native-voice |
| **デスクトップキャプチャ** | Electron API | Screen Capture API (Android 10+) |
| **ファイルシステム** | Node.js fs | expo-file-system |

---

## アーキテクチャ設計

### ディレクトリ構造

```
desktop-mate-mobile/
├── App.jsx                      # Electronの代わりにナビゲーション
├── src/
│   ├── screens/
│   │   ├── HomeScreen.jsx       # メイン画面
│   │   ├── SettingsScreen.jsx  # 設定画面
│   │   └── CharacterScreen.jsx # キャラ選択
│   ├── components/
│   │   ├── VRMViewer.jsx        # ✅ ほぼそのまま
│   │   └── ChatInterface.jsx   # UI調整必要
│   ├── services/                # ✅ 80%再利用可能
│   │   ├── aiService.js
│   │   ├── moeTTSService.js
│   │   ├── umaVoiceService.js
│   │   ├── localMotionAI.js
│   │   ├── voiceService.native.js  # 新規作成
│   │   └── tools.native.js          # 一部修正
│   └── utils/                   # ✅ ほぼそのまま
│       ├── vrmaLoader.js
│       ├── vrmGestures.js
│       └── vrmIdleAnimations.js
└── assets/
    ├── animations/              # VRMAファイル
    └── models/                  # VRMファイル
```

---

## コア実装ガイド

### 1. VRMビューアー (React Native版)

```javascript
// src/components/VRMViewer.native.jsx
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';

export default function VRMViewer({ modelUrl, onLoad }) {
  const onContextCreate = async (gl) => {
    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      30,
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      0.1,
      20
    );
    camera.position.set(0, 1.4, 3);

    // VRMローダー（デスクトップ版と同じ）
    const loader = new THREE.GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const vrm = await loader.loadAsync(modelUrl);
    scene.add(vrm.scene);
    onLoad?.(vrm);

    // アニメーションループ
    const render = () => {
      requestAnimationFrame(render);
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    render();
  };

  return <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />;
}
```

### 2. TTS統合サービス (ハイブリッド版)

```javascript
// src/services/ttsService.native.js
import * as Speech from 'expo-speech';
import * as Network from 'expo-network';
import { Audio } from 'expo-av';
import MoeTTSService from './moeTTSService';
import UmaVoiceService from './umaVoiceService';

class HybridTTSService {
  constructor() {
    this.moeTTS = new MoeTTSService();
    this.umaTTS = new UmaVoiceService();
    this.sound = null;
  }

  async speak(text, options = {}) {
    const { character, useMoeTTS = true, forceNative = false } = options;

    // ネットワーク状態確認
    const networkState = await Network.getNetworkStateAsync();
    const isOnline = networkState.isConnected && networkState.isInternetReachable;

    // WiFi接続 & オンライン時は高品質TTS
    if (isOnline && !forceNative && useMoeTTS) {
      try {
        const audioData = await this.moeTTS.generateSpeech(text, character);
        return await this.playAudioData(audioData);
      } catch (error) {
        console.warn('[TTS] API failed, fallback to native:', error);
      }
    }

    // フォールバック: ネイティブTTS
    return await Speech.speak(text, {
      language: 'ja-JP',
      pitch: 1.2,
      rate: 1.0
    });
  }

  async playAudioData(base64Audio) {
    if (this.sound) {
      await this.sound.unloadAsync();
    }

    const { sound } = await Audio.Sound.createAsync(
      { uri: `data:audio/wav;base64,${base64Audio}` },
      { shouldPlay: true }
    );
    this.sound = sound;
    await sound.playAsync();
  }

  async stop() {
    if (this.sound) {
      await this.sound.stopAsync();
      await this.sound.unloadAsync();
    }
    await Speech.stop();
  }
}

export default new HybridTTSService();
```

### 3. 音声認識 (React Native版)

```javascript
// src/services/voiceService.native.js
import Voice from '@react-native-voice/voice';

class VoiceService {
  constructor() {
    this.isListening = false;
    Voice.onSpeechResults = this.onSpeechResults.bind(this);
  }

  async startListening(callback) {
    if (this.isListening) return;

    this.callback = callback;
    this.isListening = true;

    try {
      await Voice.start('ja-JP');
    } catch (error) {
      console.error('[Voice] Start failed:', error);
      this.isListening = false;
    }
  }

  async stopListening() {
    if (!this.isListening) return;

    this.isListening = false;
    await Voice.stop();
  }

  onSpeechResults(event) {
    const text = event.value?.[0];
    if (text && this.callback) {
      this.callback(text);
    }
  }
}

export default new VoiceService();
```

### 4. メイン画面

```javascript
// src/screens/HomeScreen.jsx
import { View, TouchableOpacity, Text } from 'react-native';
import { useState, useRef } from 'react';
import VRMViewer from '../components/VRMViewer.native';
import aiService from '../services/aiService';
import ttsService from '../services/ttsService.native';
import voiceService from '../services/voiceService.native';

export default function HomeScreen() {
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const vrmRef = useRef(null);

  const handleVoiceInput = () => {
    if (isListening) {
      voiceService.stopListening();
      setIsListening(false);
    } else {
      voiceService.startListening(async (text) => {
        setMessages(prev => [...prev, { role: 'user', content: text }]);

        // AI応答
        const response = await aiService.chat([...messages, { role: 'user', content: text }]);
        setMessages(prev => [...prev, { role: 'assistant', content: response }]);

        // TTS再生
        await ttsService.speak(response, { character: 'Special Week' });

        setIsListening(false);
      });
      setIsListening(true);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <VRMViewer
        modelUrl="https://example.com/model.vrm"
        onLoad={(vrm) => { vrmRef.current = vrm; }}
      />

      <TouchableOpacity
        onPress={handleVoiceInput}
        style={{
          position: 'absolute',
          bottom: 30,
          alignSelf: 'center',
          backgroundColor: isListening ? '#f00' : '#0f0',
          padding: 20,
          borderRadius: 50
        }}
      >
        <Text>{isListening ? '🎤 聞いています...' : '🎤 タップして話す'}</Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

## スマホ特有の最適化

### 1. バッテリー最適化

```javascript
// 低電力モード検出
import * as Battery from 'expo-battery';

const batteryLevel = await Battery.getBatteryLevelAsync();
const lowPowerMode = await Battery.getPowerStateAsync();

if (lowPowerMode.lowPowerMode || batteryLevel < 0.2) {
  // アニメーションフレームレート削減
  // ネイティブTTS使用
  // 3Dモデルのポリゴン数削減
}
```

### 2. キャッシュ戦略

```javascript
// src/services/cacheService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

class CacheService {
  constructor() {
    this.audioCache = new Map();
    this.maxCacheSize = 50; // MB
  }

  async cacheAudio(text, audioData) {
    const hash = this.hashText(text);
    const filePath = `${FileSystem.cacheDirectory}tts_${hash}.wav`;

    await FileSystem.writeAsStringAsync(filePath, audioData, {
      encoding: FileSystem.EncodingType.Base64
    });

    await AsyncStorage.setItem(`audio_${hash}`, filePath);
  }

  async getCachedAudio(text) {
    const hash = this.hashText(text);
    const filePath = await AsyncStorage.getItem(`audio_${hash}`);

    if (filePath) {
      const exists = await FileSystem.getInfoAsync(filePath);
      if (exists.exists) {
        return filePath;
      }
    }
    return null;
  }

  hashText(text) {
    // 簡易ハッシュ
    return text.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0).toString(36);
  }
}

export default new CacheService();
```

### 3. オフライン対応

```javascript
// App.jsx
import NetInfo from '@react-native-community/netinfo';

const App = () => {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AppContext.Provider value={{ isOffline }}>
      {/* アプリ本体 */}
    </AppContext.Provider>
  );
};
```

---

## プラットフォーム別機能

### Android

#### ✅ 実装可能
- **フローティングウィンドウ** (react-native-floating-action)
- **常に最前面** (SYSTEM_ALERT_WINDOW権限)
- **バックグラウンド動作** (foreground service)
- **ウィジェット** (react-native-android-widget)

```javascript
// android/app/src/main/AndroidManifest.xml
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
```

#### フローティングウィンドウ実装例

```javascript
import FloatingAction from 'react-native-floating-action';

<FloatingAction
  actions={[]}
  color="#00B0FF"
  distanceToEdge={20}
  floatingIcon={<VRMViewer />}
  onPressMain={() => {
    // キャラクタータップ時の処理
  }}
/>
```

### iOS

#### ⚠️ 制約あり
- **フローティングウィンドウ** 非対応
- **常に最前面** 非対応
- **バックグラウンド** 音声再生のみ可能
- **ウィジェット** ホーム画面のみ（インタラクティブ性低い）

#### 代替案
```javascript
// ホーム画面ウィジェット（情報表示のみ）
// Live Activitiesを使用（iOS 16.1+）
// アプリ内での常駐表示
```

---

## 移植手順

### Phase 1: 基本機能移植 (1週間)

1. Expoプロジェクト作成
2. VRMViewer実装（Three.js + expo-gl）
3. AIサービス移植（OpenAI API）
4. 基本UI構築

### Phase 2: 音声機能 (1週間)

1. Moe TTS統合
2. Uma TTS統合
3. 音声認識実装
4. キャッシュシステム構築

### Phase 3: アニメーション (1週間)

1. VRMAローダー移植
2. アイドルモーション実装
3. ジェスチャーシステム
4. モーション同期

### Phase 4: 最適化 & 特殊機能 (1週間)

1. バッテリー最適化
2. オフライン対応
3. Androidフローティングウィンドウ
4. ウィジェット実装

---

## パフォーマンス目標

| 指標 | 目標値 |
|------|--------|
| 初回起動時間 | < 3秒 |
| VRMモデル読み込み | < 2秒 |
| AI応答時間 | < 3秒 |
| TTS生成時間 | < 1.5秒 |
| フレームレート | 30fps (60fps推奨) |
| メモリ使用量 | < 200MB |
| バッテリー消費 | < 5%/時間 |

---

## トラブルシューティング

### VRMモデルが表示されない

```javascript
// CORS問題の可能性
// ローカルアセットから読み込む
const modelPath = require('./assets/model.vrm');

// またはpublic URLを使用
const modelUrl = 'https://cors-anywhere.herokuapp.com/https://example.com/model.vrm';
```

### TTSが再生されない

```javascript
// 音声権限確認
import { Audio } from 'expo-av';

await Audio.requestPermissionsAsync();
await Audio.setAudioModeAsync({
  allowsRecordingIOS: false,
  playsInSilentModeIOS: true,
  staysActiveInBackground: true
});
```

### アニメーションがカクカクする

```javascript
// Three.jsのレンダラー最適化
renderer.setPixelRatio(1); // デバイスのPixelRatioを使わない
renderer.shadowMap.enabled = false; // 影を無効化
```

---

## 参考リンク

- [Expo Three Documentation](https://docs.expo.dev/versions/latest/sdk/gl-view/)
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm)
- [React Native Voice](https://github.com/react-native-voice/voice)
- [Expo Speech](https://docs.expo.dev/versions/latest/sdk/speech/)
- [React Native Floating Action](https://github.com/santomegonzalo/react-native-floating-action)

---

## ライセンス & 注意事項

- VRMモデル: 各モデルのライセンスに従う
- Mixamoアニメーション: アプリ組み込み配布OK、単体再配布NG
- Moe TTS/Uma TTS: Hugging Faceの利用規約に従う
- OpenAI API: 商用利用は有料プラン必須

---

**移植完了後の想定ファイルサイズ**
- Android APK: 約150-200MB
- iOS IPA: 約180-220MB
- アセット含む: 約300-400MB

**対応OS**
- Android 10.0+ (API Level 29+)
- iOS 14.0+
