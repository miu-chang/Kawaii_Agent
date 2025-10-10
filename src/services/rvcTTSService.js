// Parler-TTS 音声合成サービス
// 日本語対応の可愛い声で音声合成

// 利用可能な話者スタイル
const PARLER_STYLES = {
  cute_normal: {
    name: '可愛い (ノーマル)',
    description: 'A female speaker with a slightly high-pitched voice delivers her words at a moderate speed with a quite monotone tone in a confined environment, resulting in a quite clear audio recording.'
  },
  cute_expressive: {
    name: '可愛い (表現豊か)',
    description: 'A female speaker with a slightly high-pitched voice delivers her words at a moderate speed with an expressive tone in a confined environment, resulting in a quite clear audio recording.'
  },
  cute_slow: {
    name: '可愛い (ゆっくり)',
    description: 'A female speaker with a slightly high-pitched voice delivers her words slowly with a quite monotone tone in a confined environment, resulting in a quite clear audio recording.'
  },
  cute_fast: {
    name: '可愛い (速め)',
    description: 'A female speaker with a slightly high-pitched voice delivers her words quickly with a quite monotone tone in a confined environment, resulting in a quite clear audio recording.'
  }
};

class ParlerTTSService {
  constructor() {
    this.isReady = false;
    this.isSpeaking = false;
    this.currentAudio = null;
    this.styles = PARLER_STYLES;
    this.serverUrl = 'http://localhost:5050';
    this.serverProcess = null;
  }

  // ダミーメソッド（互換性のため）
  setApiKey(apiKey) {
    console.log('[Parler-TTS] setApiKey called (not needed for Parler-TTS)');
  }

  async initialize(apiKey) {
    try {
      console.log('[Parler-TTS] Initializing service...');
      console.log('[Parler-TTS] Starting server (this will take 15-20 seconds)...');

      // サーバーを起動
      const result = await window.electronAPI.startParlerTTSServer();
      if (!result.success) {
        throw new Error(result.error || 'Failed to start Parler-TTS server');
      }

      this.isReady = true;
      console.log('[Parler-TTS] Service ready');
      return true;
    } catch (error) {
      console.error('[Parler-TTS] Initialization failed:', error);
      this.isReady = false;
      return false;
    }
  }

  // 全てのスタイルをフラットリストで取得
  getAllStyles() {
    return Object.values(this.styles).map(style => style.name);
  }

  // スタイル名から設定を取得
  getStyleByName(styleName) {
    for (const [id, style] of Object.entries(this.styles)) {
      if (style.name === styleName) {
        return { id, ...style };
      }
    }
    return null;
  }

  async speak(text, options = {}) {
    if (!this.isReady) {
      console.warn('[Parler-TTS] Service not ready');
      return null;
    }

    // 既存の再生を停止
    if (this.isSpeaking) {
      this.stop();
    }

    try {
      const {
        speaker = '可愛い (ノーマル)',
        speedScale = 1.0,
        volumeScale = 1.0
      } = options;

      const styleInfo = this.getStyleByName(speaker);
      if (!styleInfo) {
        console.error('[Parler-TTS] Style not found:', speaker);
        return null;
      }

      console.log(`[Parler-TTS] Speaking with ${styleInfo.name}:`, text);

      // Parler-TTSで音声生成
      const audioUrl = await this.generateTTS(text, styleInfo);

      // 再生
      await this.playAudio(audioUrl, speedScale, volumeScale);

    } catch (error) {
      console.error('[Parler-TTS] Speech error:', error);
      this.isSpeaking = false;
      return null;
    }
  }

  /**
   * Parler-TTSで音声生成
   */
  async generateTTS(text, styleInfo) {
    console.log('[Parler-TTS] Generating speech...');

    try {
      // HTTPサーバーにリクエスト
      const response = await fetch(`${this.serverUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          description: styleInfo.description
        })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      // 音声データを取得
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      console.log('[Parler-TTS] Generation complete');
      return audioUrl;

    } catch (error) {
      console.error('[Parler-TTS] TTS generation failed:', error);
      throw error;
    }
  }

  /**
   * 音声再生
   */
  async playAudio(audioUrl, speedScale = 1.0, volumeScale = 1.0) {
    return new Promise((resolve, reject) => {
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;
      this.isSpeaking = true;

      audio.playbackRate = speedScale;
      audio.volume = volumeScale;

      audio.onended = () => {
        this.isSpeaking = false;
        this.currentAudio = null;
        console.log('[RVC TTS] Playback completed');
        resolve();
      };

      audio.onerror = (error) => {
        this.isSpeaking = false;
        this.currentAudio = null;
        reject(error);
      };

      audio.play().catch(reject);
    });
  }

  stop() {
    if (this.isSpeaking && this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
      this.isSpeaking = false;
    }
  }

  async destroy() {
    this.stop();

    // サーバーを停止
    if (this.isReady) {
      try {
        await window.electronAPI.stopParlerTTSServer();
        console.log('[Parler-TTS] Server stopped');
      } catch (error) {
        console.error('[Parler-TTS] Failed to stop server:', error);
      }
    }

    this.isReady = false;
  }
}

// シングルトンインスタンス
const parlerTTSService = new ParlerTTSService();
export default parlerTTSService;
