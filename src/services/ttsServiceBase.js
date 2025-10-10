/**
 * TTS Service Base Class
 * 全てのTTSサービスが実装すべき標準インターフェース
 */

export class TTSServiceBase {
  constructor(config = {}) {
    this.config = config;
    this.name = 'Base TTS Service';
    this.id = 'base';
  }

  /**
   * 音声合成を実行
   * @param {string} text - 合成するテキスト
   * @param {Object} options - オプション
   * @param {string} options.speaker - 話者ID/名前
   * @param {number} options.speed - 速度 (0.5-2.0)
   * @param {number} options.pitch - 音高 (-1.0-1.0)
   * @param {string} options.language - 言語コード ('ja', 'en', 'zh')
   * @returns {Promise<Blob>} 音声データ
   */
  async speak(text, options = {}) {
    throw new Error('speak() must be implemented');
  }

  /**
   * 利用可能な話者の一覧を取得
   * @returns {Promise<Array>} 話者リスト
   * 形式: [{ id: 'speaker1', name: '話者名', language: 'ja' }, ...]
   */
  async getVoices() {
    throw new Error('getVoices() must be implemented');
  }

  /**
   * サービスが利用可能かチェック
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    return true;
  }

  /**
   * サービスの初期化
   */
  async initialize() {
    // オプション：必要に応じてオーバーライド
  }

  /**
   * サービスのクリーンアップ
   */
  async dispose() {
    // オプション：必要に応じてオーバーライド
  }
}

/**
 * VOICEVOX TTS Service
 */
export class VOICEVOXTTSService extends TTSServiceBase {
  constructor() {
    super();
    this.name = 'VOICEVOX';
    this.id = 'voicevox';
    this.speakers = null;
  }

  async speak(text, options = {}) {
    const { speaker = '3', speed = 1.0, pitch = 0 } = options;

    const response = await fetch('http://localhost:50021/audio_query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        speaker: parseInt(speaker),
        speedScale: speed,
        pitchScale: pitch
      })
    });

    if (!response.ok) {
      throw new Error(`VOICEVOX query failed: ${response.statusText}`);
    }

    const query = await response.json();

    const audioResponse = await fetch(
      `http://localhost:50021/synthesis?speaker=${speaker}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query)
      }
    );

    if (!audioResponse.ok) {
      throw new Error(`VOICEVOX synthesis failed: ${audioResponse.statusText}`);
    }

    return await audioResponse.blob();
  }

  async getVoices() {
    if (this.speakers) {
      return this.speakers;
    }

    try {
      const response = await fetch('http://localhost:50021/speakers');
      const data = await response.json();

      this.speakers = data.flatMap(speaker =>
        speaker.styles.map(style => ({
          id: style.id.toString(),
          name: `${speaker.name} (${style.name})`,
          language: 'ja'
        }))
      );

      return this.speakers;
    } catch (error) {
      console.error('[VOICEVOX] Failed to fetch speakers:', error);
      return [];
    }
  }

  async isAvailable() {
    try {
      const response = await fetch('http://localhost:50021/speakers', {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * MoeTTS Service (既存のサービスをラップ)
 */
export class MoeTTSService extends TTSServiceBase {
  constructor(modelId, voices) {
    super();
    this.name = modelId === 12 ? 'MoeTTS Voistock' : 'MoeTTS Umamusume';
    this.id = `moetts-${modelId}`;
    this.modelId = modelId;
    this.voices = voices;
  }

  async speak(text, options = {}) {
    const { speaker, speed = 1.0, language = 'ja' } = options;

    // 言語タグを追加
    const taggedText = `[${language.toUpperCase()}]${text}[${language.toUpperCase()}]`;

    const response = await fetch('https://api.moetts.com/v1/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_id: this.modelId,
        speaker: speaker,
        text: taggedText,
        speed: speed
      })
    });

    if (!response.ok) {
      throw new Error(`MoeTTS failed: ${response.statusText}`);
    }

    return await response.blob();
  }

  async getVoices() {
    return this.voices;
  }

  async isAvailable() {
    // MoeTTSは常にオンライン（APIキー不要の前提）
    return true;
  }
}
