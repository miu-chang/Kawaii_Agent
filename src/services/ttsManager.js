import { Device } from '@capacitor/device';
import { Filesystem, Directory } from '@capacitor/filesystem';
import voicevoxService from './voicevoxService';
import moeTTSService from './moeTTSService';

// Web Speech API用の簡易TTSサービス
class WebSpeechTTS {
  constructor() {
    this.synthesis = window.speechSynthesis;
    this.voices = [];
  }

  async initialize() {
    return new Promise((resolve) => {
      const loadVoices = () => {
        this.voices = this.synthesis.getVoices();
        resolve();
      };

      if (this.synthesis.onvoiceschanged !== undefined) {
        this.synthesis.onvoiceschanged = loadVoices;
      }
      loadVoices();
    });
  }

  async speak(text, options = {}) {
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);

      // 日本語の声を探す
      const jaVoice = this.voices.find(v => v.lang.startsWith('ja'));
      if (jaVoice) {
        utterance.voice = jaVoice;
      }

      utterance.rate = options.speed || 1.0;
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = options.volume || 1.0;

      utterance.onend = resolve;
      utterance.onerror = reject;

      this.synthesis.speak(utterance);
    });
  }

  async getVoiceList() {
    return this.voices
      .filter(v => v.lang.startsWith('ja'))
      .map((v, i) => ({ id: i, name: v.name }));
  }

  stopSpeaking() {
    this.synthesis.cancel();
  }
}

export class TTSManager {
  constructor() {
    this.engines = new Map();
    this.hiddenEngines = new Map();
    this.currentEngine = 'voicevox';
    this.devModeEnabled = false;
  }

  async init() {
    console.log('[TTSManager] Initializing...');

    // ========================================
    // 公開エンジン（全ユーザー）
    // ========================================

    this.registerEngine('voicevox', {
      name: 'VOICEVOX',
      instance: voicevoxService,
      visible: true,
      requiresInternet: true,
      description: '高品質な日本語音声合成（商用利用可）',
      icon: '🎤'
    });

    this.registerEngine('web-speech', {
      name: 'Web Speech',
      instance: new WebSpeechTTS(),
      visible: true,
      requiresInternet: false,
      description: 'ブラウザ標準の音声合成',
      icon: '🔊'
    });

    // ========================================
    // 隠しエンジン（開発者モードのみ）
    // ========================================

    this.registerEngine('moetts', {
      name: 'MoeTTS',
      instance: moeTTSService,
      visible: false,
      hidden: true,
      requiresInternet: true,
      description: '拡張音声エンジン（個人利用向け）',
      warning: '⚠️ このエンジンは個人利用目的です。インターネット接続が必要です。使用は自己責任でお願いします。',
      charactersCount: 100,
      icon: '🔓'
    });

    // 開発者モード確認
    await this.checkDevMode();

    console.log('[TTSManager] Initialized. Dev mode:', this.devModeEnabled);
  }

  registerEngine(id, config) {
    this.engines.set(id, { id, ...config });
  }

  async checkDevMode() {
    const methods = [
      // localStorage確認
      () => localStorage.getItem('devMode') === 'true',
      () => localStorage.getItem('moetts_unlocked') === 'true',

      // 設定ファイル確認
      async () => {
        try {
          const config = await Filesystem.readFile({
            path: 'config.json',
            directory: Directory.Documents,
            encoding: 'utf8'
          });
          return JSON.parse(config.data).tts?.engines?.moetts === true;
        } catch {
          return false;
        }
      }
    ];

    for (const check of methods) {
      try {
        if (await check()) {
          this.enableHiddenEngines();
          console.log('[TTSManager] 🔓 隠しエンジンが有効になりました');
          return;
        }
      } catch (error) {
        console.log('[TTSManager] Dev mode check failed:', error);
      }
    }
  }

  // 開発者モードを有効化（10回タップで呼び出される）
  enableDevMode() {
    localStorage.setItem('devMode', 'true');
    this.enableHiddenEngines();
    console.log('[TTSManager] 🔓 開発者モードが有効になりました');
  }

  enableHiddenEngines() {
    this.devModeEnabled = true;
    // 隠しエンジンを表示
    for (const [id, engine] of this.engines) {
      if (engine.hidden) {
        engine.visible = true;
      }
    }
  }

  getVisibleEngines() {
    return Array.from(this.engines.values())
      .filter(engine => engine.visible);
  }

  getAllEngines() {
    return Array.from(this.engines.values());
  }

  getEngine(id) {
    return this.engines.get(id);
  }

  getCurrentEngine() {
    return this.engines.get(this.currentEngine);
  }

  setCurrentEngine(id) {
    if (this.engines.has(id)) {
      const engine = this.engines.get(id);
      if (engine.visible) {
        this.currentEngine = id;
        console.log('[TTSManager] Engine switched to:', id);
        return true;
      }
    }
    return false;
  }

  async speak(text, options = {}) {
    const engine = this.getCurrentEngine();
    if (!engine) {
      console.error('[TTSManager] No engine selected');
      return;
    }

    console.log('[TTSManager] Speaking with:', engine.name);
    return engine.instance.speak(text, options);
  }

  stopSpeaking() {
    const engine = this.getCurrentEngine();
    if (engine && engine.instance.stopSpeaking) {
      engine.instance.stopSpeaking();
    }
  }

  async getVoiceList(engineId = null) {
    const engine = engineId ? this.engines.get(engineId) : this.getCurrentEngine();
    if (engine && engine.instance.getVoiceList) {
      return engine.instance.getVoiceList();
    }
    return [];
  }
}

// シングルトンインスタンス
const ttsManager = new TTSManager();
export default ttsManager;
