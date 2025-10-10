// VOICEVOX Core TTS Service
// 利用可能なキャラクターとスタイル（完全版）
const VOICEVOX_SPEAKERS = [
  { name: 'ずんだもん', styles: [
    { id: 3, name: 'ノーマル' },
    { id: 1, name: 'あまあま' },
    { id: 7, name: 'ツンツン' },
    { id: 5, name: 'セクシー' },
    { id: 22, name: 'ささやき' },
    { id: 38, name: 'ヒソヒソ' },
    { id: 75, name: 'ヘロヘロ' },
    { id: 76, name: 'なみだめ' }
  ]},
  { name: '四国めたん', styles: [
    { id: 2, name: 'ノーマル' },
    { id: 0, name: 'あまあま' },
    { id: 6, name: 'ツンツン' },
    { id: 4, name: 'セクシー' },
    { id: 36, name: 'ささやき' },
    { id: 37, name: 'ヒソヒソ' }
  ]},
  { name: '春日部つむぎ', styles: [{ id: 8, name: 'ノーマル' }]},
  { name: '雨晴はう', styles: [{ id: 10, name: 'ノーマル' }]},
  { name: '波音リツ', styles: [
    { id: 9, name: 'ノーマル' },
    { id: 65, name: 'クイーン' }
  ]},
  { name: '玄野武宏', styles: [
    { id: 11, name: 'ノーマル' },
    { id: 39, name: '喜び' },
    { id: 40, name: 'ツンギレ' },
    { id: 41, name: '悲しみ' }
  ]},
  { name: '白上虎太郎', styles: [
    { id: 12, name: 'ノーマル' },
    { id: 32, name: 'わいわい' },
    { id: 33, name: 'びくびく' },
    { id: 34, name: 'おこ' }
  ]},
  { name: '青山龍星', styles: [{ id: 13, name: 'ノーマル' }]},
  { name: '冥鳴ひまり', styles: [{ id: 14, name: 'ノーマル' }]},
  { name: '九州そら', styles: [
    { id: 16, name: 'ノーマル' },
    { id: 15, name: 'あまあま' },
    { id: 18, name: 'ツンツン' },
    { id: 17, name: 'セクシー' },
    { id: 19, name: 'ささやき' }
  ]},
  { name: 'もち子さん', styles: [{ id: 20, name: 'ノーマル' }]},
  { name: '剣崎雌雄', styles: [{ id: 21, name: 'ノーマル' }]},
  { name: 'WhiteCUL', styles: [
    { id: 23, name: 'ノーマル' },
    { id: 24, name: 'たのしい' },
    { id: 25, name: 'かなしい' },
    { id: 26, name: 'びえーん' }
  ]},
  { name: '後鬼', styles: [
    { id: 27, name: '人間ver.' },
    { id: 28, name: '人間ver.(怒り)' }
  ]},
  { name: 'No.7', styles: [
    { id: 29, name: 'ノーマル' },
    { id: 30, name: 'アナウンス' },
    { id: 31, name: '読み聞かせ' }
  ]},
  { name: 'ちび式じい', styles: [{ id: 42, name: 'ノーマル' }]},
  { name: '櫻歌ミコ', styles: [
    { id: 43, name: 'ノーマル' },
    { id: 44, name: '第二形態' },
    { id: 45, name: 'ロリ' }
  ]},
  { name: '小夜/SAYO', styles: [{ id: 46, name: 'ノーマル' }]},
  { name: 'ナースロボ＿タイプＴ', styles: [
    { id: 47, name: 'ノーマル' },
    { id: 48, name: '楽々' },
    { id: 49, name: '恐れ' },
    { id: 50, name: '内緒話' }
  ]},
  { name: '†聖騎士 紅桜†', styles: [{ id: 51, name: 'ノーマル' }]},
  { name: '雀松朱司', styles: [{ id: 52, name: 'ノーマル' }]},
  { name: '麒ヶ島宗麟', styles: [{ id: 53, name: 'ノーマル' }]},
  { name: '春歌ナナ', styles: [{ id: 54, name: 'ノーマル' }]},
  { name: '猫使アル', styles: [
    { id: 55, name: 'ノーマル' },
    { id: 56, name: 'おちつき' },
    { id: 57, name: 'うきうき' }
  ]},
  { name: '猫使ビィ', styles: [
    { id: 58, name: 'ノーマル' },
    { id: 59, name: 'おちつき' },
    { id: 60, name: '人見知り' }
  ]},
  { name: '中国うさぎ', styles: [
    { id: 61, name: 'ノーマル' },
    { id: 62, name: 'おどろき' },
    { id: 63, name: 'こわがり' },
    { id: 64, name: 'ヘロヘロ' }
  ]},
  { name: '栗田まろん', styles: [{ id: 67, name: 'ノーマル' }]},
  { name: 'あいえるたん', styles: [{ id: 68, name: 'ノーマル' }]},
  { name: '満別花丸', styles: [
    { id: 69, name: 'ノーマル' },
    { id: 70, name: '元気' },
    { id: 71, name: 'ささやき' },
    { id: 72, name: 'びえーん' }
  ]},
  { name: '琴詠ニア', styles: [{ id: 73, name: 'ノーマル' }]},
  { name: '東北ずん子', styles: [{ id: 107, name: 'ノーマル' }]},
  { name: '東北きりたん', styles: [{ id: 108, name: 'ノーマル' }]},
  { name: '東北イタコ', styles: [{ id: 109, name: 'ノーマル' }]}
];

class VoicevoxService {
  constructor() {
    this.isReady = false;
    this.core = null;
    this.speakers = VOICEVOX_SPEAKERS;
    this.isSpeaking = false;
    this.currentAudio = null;
    this.localVoicevoxAvailable = false;
    this.reconnectInterval = null;
  }

  async initialize() {
    try {
      // VOICEVOXエンジンに接続を試みる（Electronが自動起動する想定）
      const response = await fetch('http://localhost:50021/speakers', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const speakers = await response.json();
        console.log('[VOICEVOX] Connected to local VOICEVOX engine, speakers:', speakers.length);

        // 実際のスピーカー情報で上書き
        this.speakers = speakers;
        this.localVoicevoxAvailable = true;
        this.isReady = true;
        this.startReconnectMonitor(); // 監視開始
        return true;
      }

      throw new Error('VOICEVOX engine not responding');
    } catch (error) {
      console.warn('[VOICEVOX] Local engine not available, will use Web API fallback:', error);

      // ローカルが使えなくてもWeb APIとWeb Speech APIがあるのでOK
      this.localVoicevoxAvailable = false;
      this.isReady = true;
      this.startReconnectMonitor(); // 監視開始（後で起動されるかもしれない）
      return true;
    }
  }

  // 定期的にローカルVOICEVOXへの再接続を試みる
  startReconnectMonitor() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }

    this.reconnectInterval = setInterval(async () => {
      const wasAvailable = this.localVoicevoxAvailable;

      try {
        const response = await fetch('http://localhost:50021/speakers', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
          if (!wasAvailable) {
            const speakers = await response.json();
            this.speakers = speakers;
            this.localVoicevoxAvailable = true;
            console.log('[VOICEVOX] Local engine detected and connected! speakers:', speakers.length);
          }
        } else {
          throw new Error('Connection failed');
        }
      } catch (error) {
        if (wasAvailable) {
          console.warn('[VOICEVOX] Local engine disconnected, falling back to Web API');
          this.localVoicevoxAvailable = false;
          this.speakers = VOICEVOX_SPEAKERS; // デフォルトに戻す
        }
      }
    }, 10000); // 10秒ごとにチェック
  }

  getSpeakers() {
    return this.speakers;
  }

  // すべてのスタイルをフラットリストで取得
  getAllStyles() {
    const styles = [];
    for (const speaker of this.speakers) {
      for (const style of speaker.styles) {
        styles.push(`${speaker.name} (${style.name})`);
      }
    }
    return styles;
  }

  // スタイル名からスピーカーとスタイルIDを取得
  getStyleByName(styleName) {
    for (const speaker of this.speakers) {
      for (const style of speaker.styles) {
        if (`${speaker.name} (${style.name})` === styleName) {
          return { speakerName: speaker.name, styleId: style.id, styleName: style.name };
        }
      }
    }
    return null;
  }

  async speak(text, options = {}) {
    if (!this.isReady) {
      console.warn('[VOICEVOX] Service not ready');
      return null;
    }

    // 既存の再生を停止
    if (this.isSpeaking) {
      this.stop();
    }

    try {
      const {
        speaker = 'ずんだもん (ノーマル)',
        speedScale = 1.0,
        volumeScale = 1.0,
        pitchScale = 0.0,  // 音高（-0.15〜0.15）
        intonationScale = 1.0  // 抑揚（0.0〜2.0）
      } = options;

      const styleInfo = this.getStyleByName(speaker);
      if (!styleInfo) {
        console.error('[VOICEVOX] Speaker not found:', speaker);
        return null;
      }

      console.log(`[VOICEVOX] Speaking with ${styleInfo.speakerName} (${styleInfo.styleName}):`, text);

      // 1. ローカルVOICEVOX APIを試す
      if (this.localVoicevoxAvailable) {
        try {
          console.log('[VOICEVOX] Trying local engine...');
          return await this.speakWithLocalAPI(text, styleInfo, speedScale, volumeScale, pitchScale, intonationScale);
        } catch (localError) {
          console.warn('[VOICEVOX] Local API failed, trying Web API:', localError);
          // localVoicevoxAvailableは監視機能が自動更新するため、ここでは変更しない
        }
      }

      // 2. Web API (voicevox.su-shiki.com) を試す
      try {
        console.log('[VOICEVOX] Trying Web API...');
        return await this.speakWithWebAPI(text, styleInfo, speedScale, volumeScale, pitchScale, intonationScale);
      } catch (webApiError) {
        console.warn('[VOICEVOX] Web API failed, falling back to Web Speech API:', webApiError);
      }

      // 3. Web Speech APIにフォールバック
      console.log('[VOICEVOX] Using Web Speech API fallback');
      return await this.speakWithWebSpeechAPI(text, speedScale, volumeScale);

    } catch (error) {
      console.error('[VOICEVOX] Speech error:', error);
      this.isSpeaking = false;
      return null;
    }
  }

  async speakWithLocalAPI(text, styleInfo, speedScale, volumeScale, pitchScale, intonationScale) {
    // 1. 音声クエリの生成
    const queryResponse = await fetch(
      `http://localhost:50021/audio_query?text=${encodeURIComponent(text)}&speaker=${styleInfo.styleId}`,
      { method: 'POST' }
    );

    if (!queryResponse.ok) {
      throw new Error('Failed to create audio query');
    }

    const audioQuery = await queryResponse.json();

    // パラメータ調整
    audioQuery.speedScale = speedScale;
    audioQuery.volumeScale = volumeScale;
    audioQuery.pitchScale = pitchScale;
    audioQuery.intonationScale = intonationScale;

    // 2. 音声合成
    const synthesisResponse = await fetch(
      `http://localhost:50021/synthesis?speaker=${styleInfo.styleId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(audioQuery)
      }
    );

    if (!synthesisResponse.ok) {
      throw new Error('Failed to synthesize audio');
    }

    const audioBlob = await synthesisResponse.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    // 3. 音声再生
    return new Promise((resolve, reject) => {
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;
      this.isSpeaking = true;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        this.isSpeaking = false;
        this.currentAudio = null;
        console.log('[VOICEVOX] Local API playback completed');
        resolve();
      };

      audio.onerror = (error) => {
        URL.revokeObjectURL(audioUrl);
        this.isSpeaking = false;
        this.currentAudio = null;
        reject(error);
      };

      audio.play().catch(reject);
    });
  }

  async speakWithWebAPI(text, styleInfo, speedScale, volumeScale, pitchScale, intonationScale) {
    // Web API (低速版・無料・APIキー不要)
    // v3 APIは音声合成をリクエストしてからダウンロードURLを取得する2段階方式
    const apiUrl = `https://api.tts.quest/v3/voicevox/synthesis?text=${encodeURIComponent(text)}&speaker=${styleInfo.styleId}&pitch=${pitchScale}&intonation=${intonationScale}&speed=${speedScale}`;

    console.log('[VOICEVOX] Web API URL:', apiUrl);

    const response = await fetch(apiUrl, { method: 'POST' });

    if (!response.ok) {
      throw new Error(`Web API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[VOICEVOX] Initial response:', JSON.stringify(data));

    if (!data.success) {
      throw new Error('Web API synthesis failed');
    }

    console.log('[VOICEVOX] Web API synthesis started, waiting for audio...');

    // 初期レスポンスから音声URLを保存（後で使う）
    const initialMp3Url = data.mp3DownloadUrl;
    const initialWavUrl = data.wavDownloadUrl;

    // audioStatusUrlで準備完了を待つ
    const statusUrl = data.audioStatusUrl;
    const maxRetries = 30; // 最大30秒待つ
    let retries = 0;
    let audioUrl = null;

    while (retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待つ

      try {
        const statusResponse = await fetch(statusUrl);
        if (!statusResponse.ok) {
          retries++;
          continue;
        }

        const statusData = await statusResponse.json();
        console.log('[VOICEVOX] Status data:', JSON.stringify(statusData));

        if (statusData.isAudioReady) {
          // ステータスレスポンスにURLがあればそれを使う、なければ初期レスポンスのURLを使う
          audioUrl = statusData.mp3DownloadUrl || statusData.wavDownloadUrl || initialMp3Url || initialWavUrl;
          console.log('[VOICEVOX] Web API audio ready:', audioUrl);
          break;
        }

        console.log('[VOICEVOX] Web API waiting... retry', retries + 1);
        retries++;
      } catch (error) {
        console.warn('[VOICEVOX] Status check failed:', error);
        retries++;
      }
    }

    if (!audioUrl) {
      throw new Error('Audio not ready after timeout');
    }

    // 音声再生（Web APIは合成時パラメータ無視するが、再生時にspeedScaleのみ適用可能）
    return new Promise((resolve, reject) => {
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;
      this.isSpeaking = true;
      audio.volume = volumeScale;
      audio.playbackRate = speedScale; // 速度のみ再生時に調整可能

      audio.onended = () => {
        this.isSpeaking = false;
        this.currentAudio = null;
        console.log('[VOICEVOX] Web API playback completed');
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

  async speakWithWebSpeechAPI(text, speedScale, volumeScale) {
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = speedScale;
      utterance.volume = volumeScale;

      // 日本語の声を選択
      const voices = window.speechSynthesis.getVoices();
      const japaneseVoice = voices.find(v => v.lang.startsWith('ja'));
      if (japaneseVoice) {
        utterance.voice = japaneseVoice;
      }

      utterance.onend = () => {
        this.isSpeaking = false;
        console.log('[VOICEVOX] Web Speech API playback completed');
        resolve();
      };

      utterance.onerror = (error) => {
        this.isSpeaking = false;
        reject(error);
      };

      this.isSpeaking = true;
      window.speechSynthesis.speak(utterance);
    });
  }

  stop() {
    if (this.isSpeaking) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
    }
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
  }

  destroy() {
    this.stop();
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    this.isReady = false;
    this.core = null;
  }
}

// シングルトンインスタンス
const voicevoxService = new VoicevoxService();
export default voicevoxService;

