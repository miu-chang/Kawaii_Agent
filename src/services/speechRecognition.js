class SpeechRecognitionService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.onResult = null;
    this.onError = null;
  }

  async start(onResult, onError) {
    // Web Speech API（Chromiumで利用可能）
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      const error = new Error('Web Speech API is not supported in this browser');
      console.error(error);
      if (onError) onError(error);
      return false;
    }

    this.onResult = onResult;
    this.onError = onError;

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'ja-JP'; // 日本語認識
    this.recognition.continuous = false; // 1回の発話のみ
    this.recognition.interimResults = false; // 確定した結果のみ

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log('[Speech Recognition] Recognized:', transcript);
      if (this.onResult) {
        this.onResult(transcript);
      }
    };

    this.recognition.onerror = (event) => {
      console.error('[Speech Recognition] Error:', event.error);
      if (this.onError) {
        this.onError(new Error(event.error));
      }
    };

    this.recognition.onend = () => {
      console.log('[Speech Recognition] Recognition ended');
      this.isListening = false;
    };

    try {
      this.recognition.start();
      this.isListening = true;
      console.log('[Speech Recognition] Started');
      return true;
    } catch (error) {
      console.error('[Speech Recognition] Start error:', error);
      if (this.onError) {
        this.onError(error);
      }
      return false;
    }
  }

  stop() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
      console.log('[Speech Recognition] Stopped');
    }
  }

  // カタカナをひらがなに変換
  katakanaToHiragana(str) {
    return str.replace(/[\u30a1-\u30f6]/g, (match) => {
      const chr = match.charCodeAt(0) - 0x60;
      return String.fromCharCode(chr);
    });
  }

  // ウェイクワード検出（部分一致）
  detectWakeWord(text, wakeWords) {
    if (!text || !wakeWords || wakeWords.length === 0) {
      console.log('[Speech Recognition] Wake word check failed: no text or wake words');
      return false;
    }

    // スペースを削除してカタカナ→ひらがな変換で正規化
    const normalizedText = this.katakanaToHiragana(text.toLowerCase().trim().replace(/\s+/g, ''));
    console.log('[Speech Recognition] Normalized text:', normalizedText);
    console.log('[Speech Recognition] Wake words to check:', wakeWords);

    for (const word of wakeWords) {
      const normalizedWord = this.katakanaToHiragana(word.toLowerCase().replace(/\s+/g, ''));
      console.log(`[Speech Recognition] Checking: "${normalizedText}" includes "${normalizedWord}"?`, normalizedText.includes(normalizedWord));
      if (normalizedText.includes(normalizedWord)) {
        console.log('[Speech Recognition] Wake word detected:', word);
        return true;
      }
    }

    console.log('[Speech Recognition] No wake word match found');
    return false;
  }

  // 終了ワード検出（部分一致）
  detectEndWord(text, endWords) {
    if (!text || !endWords || endWords.length === 0) {
      return false;
    }

    // スペースを削除してカタカナ→ひらがな変換で正規化
    const normalizedText = this.katakanaToHiragana(text.toLowerCase().trim().replace(/\s+/g, ''));

    for (const word of endWords) {
      const normalizedWord = this.katakanaToHiragana(word.toLowerCase().replace(/\s+/g, ''));
      if (normalizedText.includes(normalizedWord)) {
        console.log('[Speech Recognition] End word detected:', word);
        return true;
      }
    }

    return false;
  }
}

export default new SpeechRecognitionService();
