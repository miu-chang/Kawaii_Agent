// VITS-Umamusume 音声合成サービス (Queue API版)

class UmaVoiceService {
  constructor() {
    this.baseUrl = "https://miu-chang-vits-umamusume-fixed.hf.space";
    this.audioCache = new Map(); // 頻出フレーズをキャッシュ (最大200件)
    this.currentAudio = null;
    this.isSpeaking = false;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.isPreCaching = false;
  }

  generateSessionHash() {
    return crypto.randomUUID();
  }

  // Japanese モデル用 - 全87キャラクター（API用名前とID）
  static CHARACTER_LIST = [
    { id: 0, apiName: '特别周 Special Week (Umamusume Pretty Derby)', jpName: 'スペシャルウィーク' },
    { id: 1, apiName: '无声铃鹿 Silence Suzuka (Umamusume Pretty Derby)', jpName: 'サイレンススズカ' },
    { id: 2, apiName: '东海帝王 Tokai Teio (Umamusume Pretty Derby)', jpName: 'トウカイテイオー' },
    { id: 3, apiName: '丸善斯基 Maruzensky (Umamusume Pretty Derby)', jpName: 'マルゼンスキー' },
    { id: 4, apiName: '富士奇迹 Fuji Kiseki (Umamusume Pretty Derby)', jpName: 'フジキセキ' },
    { id: 5, apiName: '小栗帽 Oguri Cap (Umamusume Pretty Derby)', jpName: 'オグリキャップ' },
    { id: 6, apiName: '黄金船 Gold Ship (Umamusume Pretty Derby)', jpName: 'ゴールドシップ' },
    { id: 7, apiName: '伏特加 Vodka (Umamusume Pretty Derby)', jpName: 'ウオッカ' },
    { id: 8, apiName: '大和赤骥 Daiwa Scarlet (Umamusume Pretty Derby)', jpName: 'ダイワスカーレット' },
    { id: 9, apiName: '大树快车 Taiki Shuttle (Umamusume Pretty Derby)', jpName: 'タイキシャトル' },
    { id: 10, apiName: '草上飞 Grass Wonder (Umamusume Pretty Derby)', jpName: 'グラスワンダー' },
    { id: 11, apiName: '菱亚马逊 Hishi Amazon (Umamusume Pretty Derby)', jpName: 'ヒシアマゾン' },
    { id: 12, apiName: '目白麦昆 Mejiro Mcqueen (Umamusume Pretty Derby)', jpName: 'メジロマックイーン' },
    { id: 13, apiName: '神鹰 El Condor Pasa (Umamusume Pretty Derby)', jpName: 'エルコンドルパサー' },
    { id: 14, apiName: '好歌剧 T.M. Opera O (Umamusume Pretty Derby)', jpName: 'テイエムオペラオー' },
    { id: 15, apiName: '成田白仁 Narita Brian (Umamusume Pretty Derby)', jpName: 'ナリタブライアン' },
    { id: 16, apiName: '鲁道夫象征 Symboli Rudolf (Umamusume Pretty Derby)', jpName: 'シンボリルドルフ' },
    { id: 17, apiName: '气槽 Air Groove (Umamusume Pretty Derby)', jpName: 'エアグルーヴ' },
    { id: 18, apiName: '爱丽数码 Agnes Digital (Umamusume Pretty Derby)', jpName: 'アグネスデジタル' },
    { id: 19, apiName: '青云天空 Seiun Sky (Umamusume Pretty Derby)', jpName: 'セイウンスカイ' },
    { id: 20, apiName: '玉藻十字 Tamamo Cross (Umamusume Pretty Derby)', jpName: 'タマモクロス' },
    { id: 21, apiName: '美妙姿势 Fine Motion (Umamusume Pretty Derby)', jpName: 'ファインモーション' },
    { id: 22, apiName: '琵琶晨光 Biwa Hayahide (Umamusume Pretty Derby)', jpName: 'ビワハヤヒデ' },
    { id: 23, apiName: '重炮 Mayano Topgun (Umamusume Pretty Derby)', jpName: 'マヤノトップガン' },
    { id: 24, apiName: '曼城茶座 Manhattan Cafe (Umamusume Pretty Derby)', jpName: 'マンハッタンカフェ' },
    { id: 25, apiName: '美普波旁 Mihono Bourbon (Umamusume Pretty Derby)', jpName: 'ミホノブルボン' },
    { id: 26, apiName: '目白雷恩 Mejiro Ryan (Umamusume Pretty Derby)', jpName: 'メジロライアン' },
    { id: 28, apiName: '雪之美人 Yukino Bijin (Umamusume Pretty Derby)', jpName: 'ユキノビジン' },
    { id: 29, apiName: '米浴 Rice Shower (Umamusume Pretty Derby)', jpName: 'ライスシャワー' },
    { id: 30, apiName: '艾尼斯风神 Ines Fujin (Umamusume Pretty Derby)', jpName: 'アイネスフウジン' },
    { id: 31, apiName: '爱丽速子 Agnes Tachyon (Umamusume Pretty Derby)', jpName: 'アグネスタキオン' },
    { id: 32, apiName: '爱慕织姬 Admire Vega (Umamusume Pretty Derby)', jpName: 'アドマイヤベガ' },
    { id: 33, apiName: '稻荷一 Inari One (Umamusume Pretty Derby)', jpName: 'イナリワン' },
    { id: 34, apiName: '胜利奖券 Winning Ticket (Umamusume Pretty Derby)', jpName: 'ウイニングチケット' },
    { id: 35, apiName: '空中神宫 Air Shakur (Umamusume Pretty Derby)', jpName: 'エアシャカール' },
    { id: 36, apiName: '荣进闪耀 Eishin Flash (Umamusume Pretty Derby)', jpName: 'エイシンフラッシュ' },
    { id: 37, apiName: '真机伶 Curren Chan (Umamusume Pretty Derby)', jpName: 'カレンチャン' },
    { id: 38, apiName: '川上公主 Kawakami Princess (Umamusume Pretty Derby)', jpName: 'カワカミプリンセス' },
    { id: 39, apiName: '黄金城市 Gold City (Umamusume Pretty Derby)', jpName: 'ゴールドシティ' },
    { id: 40, apiName: '樱花进王 Sakura Bakushin O (Umamusume Pretty Derby)', jpName: 'サクラバクシンオー' },
    { id: 41, apiName: '采珠 Seeking the Pearl (Umamusume Pretty Derby)', jpName: 'シーキングザパール' },
    { id: 42, apiName: '新光风 Shinko Windy (Umamusume Pretty Derby)', jpName: 'シンコウウインディ' },
    { id: 43, apiName: '东商变革 Sweep Tosho (Umamusume Pretty Derby)', jpName: 'スイープトウショウ' },
    { id: 44, apiName: '超级小溪 Super Creek (Umamusume Pretty Derby)', jpName: 'スーパークリーク' },
    { id: 45, apiName: '醒目飞鹰 Smart Falcon (Umamusume Pretty Derby)', jpName: 'スマートファルコン' },
    { id: 46, apiName: '荒漠英雄 Zenno Rob Roy (Umamusume Pretty Derby)', jpName: 'ゼンノロブロイ' },
    { id: 47, apiName: '东瀛佐敦 Tosen Jordan (Umamusume Pretty Derby)', jpName: 'トーセンジョーダン' },
    { id: 48, apiName: '中山庆典 Nakayama Festa (Umamusume Pretty Derby)', jpName: 'ナカヤマフェスタ' },
    { id: 49, apiName: '成田大进 Narita Taishin (Umamusume Pretty Derby)', jpName: 'ナリタタイシン' },
    { id: 50, apiName: '西野花 Nishino Flower (Umamusume Pretty Derby)', jpName: 'ニシノフラワー' },
    { id: 51, apiName: '春乌拉拉 Haru Urara (Umamusume Pretty Derby)', jpName: 'ハルウララ' },
    { id: 52, apiName: '青竹回忆 Bamboo Memory (Umamusume Pretty Derby)', jpName: 'バンブーメモリー' },
    { id: 55, apiName: '待兼福来 Matikane Fukukitaru (Umamusume Pretty Derby)', jpName: 'マチカネフクキタル' },
    { id: 57, apiName: '名将怒涛 Meisho Doto (Umamusume Pretty Derby)', jpName: 'メイショウドトウ' },
    { id: 58, apiName: '目白多伯 Mejiro Dober (Umamusume Pretty Derby)', jpName: 'メジロドーベル' },
    { id: 59, apiName: '优秀素质 Nice Nature (Umamusume Pretty Derby)', jpName: 'ナイスネイチャ' },
    { id: 60, apiName: '帝王光环 King Halo (Umamusume Pretty Derby)', jpName: 'キングヘイロー' },
    { id: 61, apiName: '待兼诗歌剧 Matikane Tannhauser (Umamusume Pretty Derby)', jpName: 'マチカネタンホイザ' },
    { id: 62, apiName: '生野狄杜斯 Ikuno Dictus (Umamusume Pretty Derby)', jpName: 'イクノディクタス' },
    { id: 63, apiName: '目白善信 Mejiro Palmer (Umamusume Pretty Derby)', jpName: 'メジロパーマー' },
    { id: 64, apiName: '大拓太阳神 Daitaku Helios (Umamusume Pretty Derby)', jpName: 'ダイタクヘリオス' },
    { id: 65, apiName: '双涡轮 Twin Turbo (Umamusume Pretty Derby)', jpName: 'ツインターボ' },
    { id: 66, apiName: '里见光钻 Satono Diamond (Umamusume Pretty Derby)', jpName: 'サトノダイヤモンド' },
    { id: 67, apiName: '北部玄驹 Kitasan Black (Umamusume Pretty Derby)', jpName: 'キタサンブラック' },
    { id: 68, apiName: '樱花千代王 Sakura Chiyono O (Umamusume Pretty Derby)', jpName: 'サクラチヨノオー' },
    { id: 69, apiName: '天狼星象征 Sirius Symboli (Umamusume Pretty Derby)', jpName: 'シリウスシンボリ' },
    { id: 70, apiName: '目白阿尔丹 Mejiro Ardan (Umamusume Pretty Derby)', jpName: 'メジロアルダン' },
    { id: 71, apiName: '八重无敌 Yaeno Muteki (Umamusume Pretty Derby)', jpName: 'ヤエノムテキ' },
    { id: 72, apiName: '鹤丸刚志 Tsurumaru Tsuyoshi (Umamusume Pretty Derby)', jpName: 'ツルマルツヨシ' },
    { id: 73, apiName: '目白光明 Mejiro Bright (Umamusume Pretty Derby)', jpName: 'メジロブライト' },
    { id: 74, apiName: '樱花桂冠 Sakura Laurel (Umamusume Pretty Derby)', jpName: 'サクラローレル' },
    { id: 75, apiName: '成田路 Narita Top Road (Umamusume Pretty Derby)', jpName: 'ナリタトップロード' },
    { id: 76, apiName: '也文摄辉 Yamanin Zephyr (Umamusume Pretty Derby)', jpName: 'ヤマニンゼファー' },
    { id: 80, apiName: '真弓快车 Aston Machan (Umamusume Pretty Derby)', jpName: 'アストンマーチャン' },
    { id: 81, apiName: '骏川手纲 Hayakawa Tazuna (Umamusume Pretty Derby)', jpName: 'ハヤカワタズナ' },
    { id: 83, apiName: '小林历奇 Kopano Rickey (Umamusume Pretty Derby)', jpName: 'コパノリッキー' },
    { id: 85, apiName: '奇锐骏 Wonder Acute (Umamusume Pretty Derby)', jpName: 'ワンダーアキュート' },
    { id: 86, apiName: '秋川理事长 President Akikawa (Umamusume Pretty Derby)', jpName: '秋川理事長' }
  ];

  // キャラクターIDからAPI用の名前を取得
  getCharacterName(characterId) {
    const character = UmaVoiceService.CHARACTER_LIST.find(c => c.id === characterId);
    return character ? character.apiName : UmaVoiceService.CHARACTER_LIST[0].apiName;
  }

  // 日本語名からキャラクター情報を取得
  static getCharacterByJpName(jpName) {
    return UmaVoiceService.CHARACTER_LIST.find(c => c.jpName === jpName);
  }

  // 全キャラクターリストを取得（日本語名でソート）
  static getAllCharacters() {
    return [...UmaVoiceService.CHARACTER_LIST].sort((a, b) => a.jpName.localeCompare(b.jpName, 'ja'));
  }

  /**
   * テキストを音声に変換して再生
   * @param {string} text - 読み上げるテキスト
   * @param {number} characterId - キャラクターID (0-9)
   * @param {string} language - 言語 ('日本語', 'English', '简体中文')
   * @param {number} speed - 読み上げ速度 (0.5-2.0)
   * @param {Function} onSynthesisStart - 音声合成開始時のコールバック
   * @param {Function} onPlaybackStart - 再生開始時のコールバック
   */
  async speak(text, options = {}) {
    const {
      characterId = 0,
      language = '日本語',
      speed = 1.0,
      onSynthesisStart = null,
      onPlaybackStart = null
    } = options;

    // テキストクリーニング（絵文字などを除去）
    const cleanedText = text
      .replace(/\r\n|\n/g, '。')
      .replace(/[\u{1F300}-\u{1FAFF}]/gu, '');

    const characterName = this.getCharacterName(characterId);
    const cacheKey = `${cleanedText}_${characterId}_${language}_${speed}`;

    try {
      let audioDataUrl;

      if (this.audioCache.has(cacheKey)) {
        console.log('Using cached audio');
        this.cacheHits++;
        audioDataUrl = this.audioCache.get(cacheKey);
      } else {
        console.log('Synthesizing new audio...');
        this.cacheMisses++;

        // 音声合成開始コールバック
        if (onSynthesisStart) {
          onSynthesisStart();
        }

        audioDataUrl = await this.synthesizeViaQueue(cleanedText, characterName, language, speed);

        if (this.audioCache.size >= 200) {
          const firstKey = this.audioCache.keys().next().value;
          this.audioCache.delete(firstKey);
        }
        this.audioCache.set(cacheKey, audioDataUrl);
      }

      // 再生開始コールバック
      if (onPlaybackStart) {
        onPlaybackStart();
      }

      await this.playAudio(audioDataUrl);

    } catch (error) {
      console.error('Voice synthesis failed:', error);
      this.fallbackSpeak(text);
    }
  }

  /**
   * Queue API経由で音声合成
   * @param {string} text - テキスト
   * @param {string} character - キャラクター名
   * @param {string} language - 言語
   * @param {number} speed - 速度
   * @returns {Promise<string>} Base64音声データURL
   */
  async synthesizeViaQueue(text, character, language, speed) {
    const sessionHash = this.generateSessionHash();
    const fnIndex = 8; // Japanese モデル (87キャラクター)

    // 1. /queue/join に POST
    const joinResponse = await fetch(`${this.baseUrl}/queue/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fn_index: fnIndex,
        data: [text, character, language, speed, false],
        session_hash: sessionHash
      })
    });

    if (!joinResponse.ok) {
      throw new Error(`Queue join failed: ${joinResponse.status}`);
    }

    console.log('Queue joined successfully');

    // 2. EventSource で /queue/data を監視
    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(
        `${this.baseUrl}/queue/data?session_hash=${sessionHash}`
      );

      eventSource.onmessage = (event) => {
        if (!event.data) return;

        try {
          const msg = JSON.parse(event.data);
          console.log('Queue event:', msg.msg);

          if (msg.msg === 'process_completed') {
            eventSource.close();

            const output = msg.output?.data;
            console.log('Full output:', output);

            if (!output || output.length < 2) {
              return reject(new Error('Unexpected output structure'));
            }

            // output[1] が Audio オブジェクト
            const audioObj = output[1];
            console.log('Audio object:', audioObj);
            console.log('Audio object type:', typeof audioObj);

            let audioDataUrl;

            if (typeof audioObj === 'string') {
              audioDataUrl = audioObj;
            } else if (audioObj && audioObj.data) {
              audioDataUrl = audioObj.data;
            } else if (audioObj && audioObj.url) {
              audioDataUrl = audioObj.url;
            }

            if (!audioDataUrl) {
              console.error('Could not extract audio URL from:', audioObj);
              return reject(new Error('No audio data in output'));
            }

            console.log('Audio data URL (first 100 chars):', audioDataUrl.substring(0, 100));
            console.log('Audio synthesis completed');
            resolve(audioDataUrl);

          } else if (msg.msg === 'process_error') {
            eventSource.close();
            reject(new Error('Process error: ' + event.data));
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
   * @param {string} audioUrl - 音声URL (HTTP URL または base64 data URL)
   */
  async playAudio(audioUrl) {
    return new Promise((resolve, reject) => {
      // 現在再生中の音声を停止
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }

      // URL をそのまま使用（HTTP URL または data: URL）
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
   * @param {string} text - 読み上げるテキスト
   */
  fallbackSpeak(text) {
    console.log('[UmaVoice] Fallback speech disabled, text:', text);
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

    // Web Speech APIも停止
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
   * キャラクター一覧（例）
   * 実際のIDとキャラ名の対応は要確認
   */
  getCharacters() {
    return [
      { id: 0, name: 'スペシャルウィーク' },
      { id: 1, name: 'サイレンススズカ' },
      { id: 2, name: 'トウカイテイオー' },
      { id: 3, name: 'メジロマックイーン' },
      { id: 4, name: 'オグリキャップ' },
      { id: 5, name: 'タイキシャトル' },
      { id: 6, name: 'ウオッカ' },
      { id: 7, name: 'ダイワスカーレット' },
      // ... 他のキャラクターも追加可能
    ];
  }
}

// シングルトンインスタンス
const umaVoiceService = new UmaVoiceService();
export default umaVoiceService;
