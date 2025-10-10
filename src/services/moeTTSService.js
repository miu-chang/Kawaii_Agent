// Moe TTS 音声合成サービス
// model12: Voistock (2891 Anime characters)
// model15: Japanese Umamusume (87 characters)

class MoeTTSService {
  constructor() {
    this.baseUrl = "https://skytnt-moe-tts.hf.space";
    this.audioCache = new Map();
    this.currentAudio = null;
    this.isSpeaking = false;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.characterLists = {}; // モデル別のキャラクターリスト
    this.modelMetadata = {}; // モデルごとのメタデータキャッシュ
    this.serviceInfo = null;
    this.serviceConfig = null;
  }

  generateSessionHash() {
    return crypto.randomUUID();
  }

  /**
   * 利用可能なモデル一覧
   */
  static MODELS = {
    12: {
      name: 'Voistock',
      description: '2891 Anime characters',
      apiEndpoint: '/tts_fn_12',
      language: 'Multi'
    },
    15: {
      name: 'Umamusume',
      description: '87 Japanese characters',
      apiEndpoint: '/tts_fn_15',
      language: 'Japanese'
    }
  };

  /**
   * 指定モデルのキャラクターリストを取得
   * @param {number} modelId - モデルID (12 or 15)
   * @returns {Promise<Array<string>>} キャラクター名のリスト
   */
  async getCharacters(modelId = 15) {
    if (this.characterLists[modelId]) {
      return this.characterLists[modelId];
    }

    try {
      const metadata = await this.loadModelMetadata(modelId);
      this.characterLists[modelId] = metadata.characters;
      return metadata.characters;
    } catch (error) {
      console.error('Failed to fetch character list:', error);
      return modelId === 15
        ? ['Special Week', 'Silence Suzuka', 'Tokai Teio']
        : ['Default Character'];
    }
  }

  async ensureServiceMetadata() {
    if (this.serviceInfo && this.serviceConfig) {
      return;
    }

    const [infoResponse, configResponse] = await Promise.all([
      fetch(`${this.baseUrl}/info`),
      fetch(`${this.baseUrl}/config`)
    ]);

    if (!infoResponse.ok) {
      throw new Error(`Failed to load service info: ${infoResponse.status}`);
    }

    if (!configResponse.ok) {
      throw new Error(`Failed to load service config: ${configResponse.status}`);
    }

    this.serviceInfo = await infoResponse.json();
    this.serviceConfig = await configResponse.json();
  }

  async loadModelMetadata(modelId) {
    if (this.modelMetadata[modelId]) {
      return this.modelMetadata[modelId];
    }

    const endpoint = MoeTTSService.MODELS[modelId]?.apiEndpoint;
    if (!endpoint) {
      throw new Error(`Unknown model ID: ${modelId}`);
    }

    await this.ensureServiceMetadata();

    const endpointData = this.serviceInfo?.named_endpoints?.[endpoint];
    if (!endpointData) {
      throw new Error(`Endpoint ${endpoint} not found in service info`);
    }

    const speakerParam = endpointData.parameters.find(p => p.parameter_name === 'speaker');
    const characters = speakerParam?.type?.enum || [];

    const dependencies = this.serviceConfig?.dependencies || [];
    const apiName = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const dependency = dependencies.find(dep => dep.api_name === apiName);

    const fnIndex = dependency?.id;
    if (typeof fnIndex !== 'number') {
      throw new Error(`Could not determine fn_index for ${apiName}`);
    }

    const metadata = { fnIndex, characters };
    this.modelMetadata[modelId] = metadata;
    if (characters.length && !this.characterLists[modelId]) {
      this.characterLists[modelId] = characters;
    }
    return metadata;
  }

  /**
   * 音声合成のみ（再生なし）
   * @param {string} text - 読み上げるテキスト
   * @param {Object} options - オプション
   * @returns {Promise<string>} 音声URL
   */
  async synthesize(text, options = {}) {
    const {
      modelId = 15,
      speaker = 'Special Week',
      speed = 1.0,
      language = 'JA'
    } = options;

    // テキストクリーニング (150単語制限に注意)
    let cleanedText = text
      .replace(/\r\n|\n/g, '。')
      .replace(/[\u{1F300}-\u{1FAFF}]/gu, '');

    // 150文字に制限（安全のため）
    if (cleanedText.length > 150) {
      cleanedText = cleanedText.substring(0, 150);
    }

    // Voistock (model 12) の場合は言語タグを追加
    if (modelId === 12) {
      cleanedText = `[${language}]${cleanedText}[${language}]`;
    }

    const cacheKey = `${modelId}_${cleanedText}_${speaker}_${speed}_${language}`;

    if (this.audioCache.has(cacheKey)) {
      console.log('Using cached audio');
      this.cacheHits++;
      return this.audioCache.get(cacheKey);
    }

    console.log(`Synthesizing with Moe TTS model${modelId}...`);
    this.cacheMisses++;

    const audioUrl = await this.synthesizeViaAPI(cleanedText, modelId, speaker, speed);

    // キャッシュサイズ制限
    if (this.audioCache.size >= 200) {
      const firstKey = this.audioCache.keys().next().value;
      this.audioCache.delete(firstKey);
    }
    this.audioCache.set(cacheKey, audioUrl);

    return audioUrl;
  }

  /**
   * テキストを音声に変換して再生
   * @param {string} text - 読み上げるテキスト
   * @param {Object} options - オプション
   * @param {number} options.modelId - モデルID (12 or 15, デフォルト: 15)
   * @param {string} options.speaker - スピーカー名
   * @param {number} options.speed - 読み上げ速度 (0.5-2.0)
   * @param {Function} options.onSynthesisStart - 音声合成開始時のコールバック
   * @param {Function} options.onPlaybackStart - 再生開始時のコールバック
   */
  async speak(text, options = {}) {
    const {
      modelId = 15,
      speaker = 'Special Week',
      speed = 1.0,
      language = 'JA',
      onSynthesisStart = null,
      onPlaybackStart = null,
      onPlaybackEnd = null
    } = options;

    try {
      if (onSynthesisStart) {
        onSynthesisStart();
      }

      const audioUrl = await this.synthesize(text, { modelId, speaker, speed, language });

      if (onPlaybackStart) {
        onPlaybackStart();
      }

      await this.playAudio(audioUrl);

      if (onPlaybackEnd) {
        onPlaybackEnd();
      }

    } catch (error) {
      console.error('Moe TTS synthesis failed:', error);
      this.fallbackSpeak(text);
      if (onPlaybackEnd) {
        onPlaybackEnd();
      }
    }
  }

  /**
   * Gradio API経由で音声合成
   * @param {string} text - テキスト
   * @param {number} modelId - モデルID
   * @param {string} speaker - スピーカー名
   * @param {number} speed - 速度
   * @returns {Promise<string>} 音声URL
   */
  async synthesizeViaAPI(text, modelId, speaker, speed) {
    const sessionHash = this.generateSessionHash();

    // モデルメタデータを確実に読み込む
    if (!this.modelMetadata[modelId]) {
      console.log(`Loading metadata for model ${modelId}...`);
      await this.loadModelMetadata(modelId);
    }

    const fnIndex = this.modelMetadata[modelId]?.fnIndex;
    if (typeof fnIndex !== 'number') {
      throw new Error(`Could not determine fn_index for model ID: ${modelId}`);
    }

    console.log(`Using fn_index: ${fnIndex} for model ${modelId}`);

    // 1. /queue/join に POST (VITS-Umamusumeと同じフォーマット)
    const requestBody = {
      fn_index: fnIndex,
      data: [text, speaker, speed, false], // [text, speaker, speed, is_symbol]
      session_hash: sessionHash
    };
    console.log('Sending queue/join request:', JSON.stringify(requestBody, null, 2));

    const joinResponse = await fetch(`${this.baseUrl}/queue/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!joinResponse.ok) {
      throw new Error(`Queue join failed: ${joinResponse.status}`);
    }

    const joinData = await joinResponse.json();
    console.log('Queue joined:', joinData);

    // 2. EventSource で /queue/data を監視
    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(
        `${this.baseUrl}/queue/data?session_hash=${sessionHash}`
      );

      eventSource.onmessage = (event) => {
        if (!event.data) return;

        try {
          const msg = JSON.parse(event.data);
          console.log('Queue event:', msg.msg, msg);

          if (msg.msg === 'process_completed') {
            eventSource.close();

            console.log('Full msg:', JSON.stringify(msg, null, 2));

            // success が false の場合はエラー
            if (msg.success === false) {
              console.error('Process failed. Full message:', msg);
              return reject(new Error('Process failed with success=false'));
            }

            const output = msg.output?.data;
            if (!output || output.length < 2) {
              console.error('Invalid output structure. msg.output:', msg.output);
              return reject(new Error('Unexpected output structure'));
            }

            // output[1] が Audio オブジェクト
            const audioObj = output[1];
            let audioUrl;

            if (typeof audioObj === 'string') {
              audioUrl = audioObj;
            } else if (audioObj && audioObj.url) {
              audioUrl = audioObj.url;
            } else if (audioObj && audioObj.path) {
              // pathの場合、完全なURLを構築
              audioUrl = `${this.baseUrl}/file=${audioObj.path}`;
            }

            if (!audioUrl) {
              console.error('Could not extract audio URL from:', audioObj);
              return reject(new Error('No audio data in output'));
            }

            console.log('Audio synthesis completed:', audioUrl);
            resolve(audioUrl);

          } else if (msg.msg === 'process_error') {
            eventSource.close();
            reject(new Error('Process error: ' + JSON.stringify(msg)));
          }
        } catch (err) {
          // 途中のイベント（estimation など）は無視
        }
      };

      eventSource.onerror = (err) => {
        eventSource.close();
        reject(new Error('SSE connection error'));
      };

      // タイムアウト設定（60秒）
      setTimeout(() => {
        eventSource.close();
        reject(new Error('Synthesis timeout'));
      }, 60000);
    });
  }

  /**
   * 音声を再生
   * @param {string} audioUrl - 音声URL
   */
  async playAudio(audioUrl) {
    return new Promise((resolve, reject) => {
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }

      const audio = new Audio(audioUrl);
      this.currentAudio = audio;
      this.isSpeaking = true;

      audio.onended = () => {
        this.isSpeaking = false;
        this.currentAudio = null;
        resolve();
      };

      audio.onerror = (error) => {
        console.error('Audio playback error:', error);
        console.error('Failed URL:', audioUrl);
        this.isSpeaking = false;
        this.currentAudio = null;
        reject(error);
      };

      audio.play().catch(reject);
    });
  }

  /**
   * フォールバック: ブラウザのWeb Speech API (無効化)
   */
  fallbackSpeak(text) {
    console.log('[MoeTTS] Fallback speech disabled, text:', text);
    // Web Speech APIのフォールバックを無効化
    // 状態管理のみ実施
    this.isSpeaking = false;
  }

  /**
   * 再生を停止
   */
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.isSpeaking = false;

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * 再生中かどうか
   */
  isSpeakingNow() {
    return this.isSpeaking;
  }

  /**
   * キャッシュ統計を取得
   */
  getCacheStats() {
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      size: this.audioCache.size,
      hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0
    };
  }
}

// シングルトンインスタンス
const moeTTSService = new MoeTTSService();
export default moeTTSService;
