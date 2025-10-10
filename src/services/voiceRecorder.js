import { MicVAD } from "@ricky0123/vad-web";
import { createModel } from "vosk-browser";
import voicePrintService from './voicePrintService';

class VoiceRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isListening = false;
    this.onResult = null;
    this.onError = null;
    this.vad = null;
    this.vadAudioChunks = [];
    this.voskModel = null;
    this.voskRecognizer = null;

    // Whisperのハルシネーション（幻聴）対策用のブラックリスト
    this.hallucinationPhrases = [
      'ご視聴ありがとうございました',
      '最後までご視聴いただきありがとうございます',
      'ご視聴',
      'ご清聴ありがとうございました',
      'ご清聴',
      'ご覧いただきありがとう',
      'チャンネル登録',
      '高評価',
      'コメント欄',
      '次回の動画',
      'またお会いしましょう',
      'それではまた',
      'バイバイ',
      '小成長',
      '以上で終わりです',
      'Thank you for watching',
      'Please subscribe',
      'See you next time'
    ];
  }

  // Whisper APIを呼び出す共通関数（Vercel経由）
  async transcribeAudio(audioBlob, filename = 'recording.wav') {
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, filename);
      formData.append('model', 'whisper-1');
      formData.append('language', 'ja');
      formData.append('temperature', '0');
      formData.append('prompt', '日本語の会話');

      const backendUrl = process.env.BACKEND_API_URL || 'https://kawaii-agent-backend.vercel.app';
      const response = await fetch(`${backendUrl}/api/whisper`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Whisper API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[Whisper] API error:', error);
      throw error;
    }
  }

  // ハルシネーション検出
  isHallucination(text) {
    const lowerText = text.toLowerCase().trim();

    // 空または極端に短い
    if (!text || text.trim().length < 2) {
      return true;
    }

    // ブラックリストに含まれるフレーズをチェック
    return this.hallucinationPhrases.some(phrase =>
      lowerText.includes(phrase.toLowerCase())
    );
  }

  async startRecording(onResult, onError) {
    try {
      this.onResult = onResult;
      this.onError = onError;
      this.audioChunks = [];

      // マイクアクセスを取得
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.mediaRecorder = new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = async () => {
        try {
          // 音声データをBlobに変換
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

          // Vercelエンドポイント経由でWhisper APIを呼び出し
          const result = await this.transcribeAudio(audioBlob, 'recording.webm');

          if (result.text) {
            // ハルシネーションチェック
            if (this.isHallucination(result.text)) {
              console.log('[Whisper] Hallucination detected, ignoring:', result.text);
              return; // 結果を無視
            }

            if (this.onResult) {
              this.onResult(result.text);
            }
          } else {
            throw new Error('音声認識結果が空です');
          }
        } catch (error) {
          console.error('音声認識エラー:', error);
          if (this.onError) {
            this.onError(error);
          }
        }
      };

      this.mediaRecorder.start();
      this.isListening = true;
      return true;
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isListening) {
      this.mediaRecorder.stop();
      this.isListening = false;

      // ストリームを停止
      if (this.mediaRecorder.stream) {
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
    }
  }

  isRecording() {
    return this.isListening;
  }

  async startRecordingWithVAD(onResult, onError) {
    try {
      this.onResult = onResult;
      this.onError = onError;
      this.vadAudioChunks = [];

      console.log('[VAD] Initializing VAD...');

      this.vad = await MicVAD.new({
        modelURL: "./silero_vad_legacy.onnx",
        workletURL: "./vad.worklet.bundle.min.js",
        onSpeechStart: () => {
          console.log('[VAD] Speech detected - recording started');
          this.vadAudioChunks = [];
          this.isListening = true;
        },
        onSpeechEnd: async (audio) => {
          console.log('[VAD] Speech ended - processing audio');
          this.isListening = false;

          try {
            // Float32Arrayを16bit PCM WAVに変換
            const wavBlob = this.floatTo16BitPCM(audio);

            // Vercelエンドポイント経由でWhisper APIを呼び出し
            const result = await this.transcribeAudio(wavBlob, 'recording.wav');

            if (result.text) {
              // ハルシネーションチェック
              if (this.isHallucination(result.text)) {
                console.log('[VAD] Hallucination detected, ignoring:', result.text);
                return; // 結果を無視
              }

              if (this.onResult) {
                this.onResult(result.text);
              }
            } else {
              throw new Error('音声認識結果が空です');
            }
          } catch (error) {
            console.error('[VAD] 音声認識エラー:', error);
            if (this.onError) {
              this.onError(error);
            }
          }
        },
        onVADMisfire: () => {
          console.log('[VAD] False positive detected');
          this.isListening = false;
        }
      });

      this.vad.start();
      console.log('[VAD] VAD started successfully');
      return true;
    } catch (error) {
      console.error('[VAD] Error starting VAD:', error);
      throw error;
    }
  }

  async startRecordingWithVADv2(onResult, onError, options = {}) {
    try {
      this.onResult = onResult;
      this.onError = onError;
      this.vadAudioChunks = [];

      const {
        onSpeechRecognition = null,  // Web Speech APIの結果コールバック
        isConversationMode = () => false,  // 連続会話モード判定用関数
      } = options;

      console.log('[VAD] Initializing VAD with wake word detection...');

      // Web Speech API初期化
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      let recognition = null;

      if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = 'ja-JP';
        recognition.continuous = false;
        recognition.interimResults = false;
      }

      this.vad = await MicVAD.new({
        modelURL: "./silero_vad_legacy.onnx",
        workletURL: "./vad.worklet.bundle.min.js",
        onSpeechStart: () => {
          console.log('[VAD] Speech detected - starting recognition');
          this.vadAudioChunks = [];
          this.isListening = true;

          // Web Speech API起動（無料・軽量な認識）
          if (recognition && onSpeechRecognition) {
            recognition.onresult = (event) => {
              const transcript = event.results[0][0].transcript;
              console.log('[Web Speech] Recognized:', transcript);
              onSpeechRecognition(transcript);
            };
            recognition.onerror = (event) => {
              // ネットワークエラーは頻繁に発生するため、警告レベルで記録
              if (event.error === 'network') {
                console.warn('[Web Speech] Network error (これは正常です - インターネット接続が必要)');
              } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
                // no-speech と aborted は正常な動作
                console.error('[Web Speech] Error:', event.error);
              }
            };
            try {
              recognition.start();
              console.log('[Web Speech] Started for wake word detection');
            } catch (error) {
              // 既に起動中の場合のエラーは無視
              if (error.message && error.message.includes('already started')) {
                console.log('[Web Speech] Already running, skipping start');
              } else {
                console.error('[Web Speech] Start error:', error);
              }
            }
          }
        },
        onSpeechEnd: async (audio) => {
          console.log('[VAD] Speech ended');
          this.isListening = false;

          // Web Speech API停止
          if (recognition) {
            try {
              recognition.stop();
            } catch (error) {
              // 既に停止している場合は無視
            }
          }

          // 連続会話モード中のみWhisper APIを使用（高精度・有料）
          if (isConversationMode()) {
            console.log('[VAD] Conversation mode active - using Whisper API');
            try {
              // Float32Arrayを16bit PCM WAVに変換
              const wavBlob = this.floatTo16BitPCM(audio);

              // Vercelエンドポイント経由でWhisper APIを呼び出し
              const result = await this.transcribeAudio(wavBlob, 'recording.wav');

              if (result.text) {
                if (this.isHallucination(result.text)) {
                  console.log('[VAD] Hallucination detected, ignoring:', result.text);
                  return;
                }

                if (this.onResult) {
                  this.onResult(result.text);
                }
              }
            } catch (error) {
              console.error('[VAD] Whisper API error:', error);
              if (this.onError) {
                this.onError(error);
              }
            }
          } else {
            console.log('[VAD] Not in conversation mode - skipping Whisper API');
          }
        },
        onVADMisfire: () => {
          console.log('[VAD] False positive detected');
          this.isListening = false;

          if (recognition) {
            try {
              recognition.stop();
            } catch (error) {
              // 既に停止している場合は無視
            }
          }
        }
      });

      this.vad.start();
      console.log('[VAD] VAD started with wake word detection');
      return true;
    } catch (error) {
      console.error('[VAD] Error starting VAD:', error);
      throw error;
    }
  }

  stopVAD() {
    if (this.vad) {
      console.log('[VAD] Stopping VAD...');
      this.vad.pause();
      this.vad.destroy();
      this.vad = null;
      this.isListening = false;
    }
    if (this.voskRecognizer) {
      this.voskRecognizer.remove();
      this.voskRecognizer = null;
    }
  }

  // Voskを使ったウェイクワード検出
  async startRecordingWithVADv3(onResult, onError, options = {}) {
    try {
      this.onResult = onResult;
      this.onError = onError;
      this.vadAudioChunks = [];

      const {
        onVoskRecognition = null,  // Voskの結果コールバック（ウェイクワード検出用）
        isConversationMode = () => false,  // 連続会話モード判定用関数
      } = options;

      console.log('[VAD] Initializing VAD with voice print verification...');

      this.vad = await MicVAD.new({
        modelURL: "./silero_vad_legacy.onnx",
        workletURL: "./vad.worklet.bundle.min.js",
        onSpeechStart: () => {
          console.log('[VAD] Speech detected - ready for voice print check');
          this.vadAudioChunks = [];
          this.isListening = true;
        },
        onSpeechEnd: async (audio) => {
          console.log('[VAD] Speech ended');
          this.isListening = false;

          // 声紋認証チェック（登録済みの場合のみ）
          if (voicePrintService.isRegistered()) {
            try {
              // Float32ArrayをAudioBufferに変換（声紋認証用）
              const audioContext = new AudioContext({ sampleRate: 16000 });
              const audioBuffer = audioContext.createBuffer(1, audio.length, 16000);
              audioBuffer.getChannelData(0).set(audio);

              // 声紋認証
              const isVerified = voicePrintService.verifyVoice(audioBuffer, 16000);
              await audioContext.close();

              if (!isVerified) {
                console.log('[VoicePrint] Voice not verified - ignoring speech (YouTube/background audio)');
                return; // 登録ユーザーの声ではない → Whisper APIスキップ（コスト削減）
              }

              console.log('[VoicePrint] Voice verified - sending to Whisper API');
            } catch (error) {
              console.error('[VoicePrint] Verification error:', error);
              // エラー時は処理を続行（フェイルオープン）
            }
          } else {
            // 声紋認証が未登録の場合はWhisper APIを呼び出さない（コスト削減）
            console.log('[VoicePrint] Not registered - ignoring speech');
            return;
          }

          // Whisper APIで認識（ウェイクワード検出 or 会話）
          console.log('[VAD] Using Whisper API for recognition');
          try {
            // Float32Arrayを16bit PCM WAVに変換
            const wavBlob = this.floatTo16BitPCM(audio);

            // Vercelエンドポイント経由でWhisper APIを呼び出し
            const result = await this.transcribeAudio(wavBlob, 'recording.wav');

            if (result.text) {
              if (this.isHallucination(result.text)) {
                console.log('[Whisper] Hallucination detected, ignoring:', result.text);
                return;
              }

              const conversationMode = isConversationMode();

              // ウェイクワード検出用コールバック（会話モードでない場合）
              if (!conversationMode && onVoskRecognition) {
                console.log('[Whisper] Wake word detection:', result.text);
                onVoskRecognition(result.text);
              }

              // 会話モード中は通常の結果コールバック
              if (conversationMode && this.onResult) {
                console.log('[Whisper] Conversation mode:', result.text);
                this.onResult(result.text);
              }
            }
          } catch (error) {
            console.error('[VAD] Whisper API error:', error);
            if (this.onError) {
              this.onError(error);
            }
          }
        },
        onVADMisfire: () => {
          console.log('[VAD] False positive detected');
          this.isListening = false;
        }
      });

      this.vad.start();
      console.log('[VAD] VAD started with voice print verification and Whisper recognition');
      return true;
    } catch (error) {
      console.error('[VAD] Error starting VAD:', error);
      throw error;
    }
  }

  // Float32ArrayをPCMバッファに変換（Vosk用）
  floatTo16BitPCMBuffer(float32Array) {
    const buffer = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return buffer;
  }

  // Float32ArrayをWAV形式に変換
  floatTo16BitPCM(float32Array) {
    const buffer = new ArrayBuffer(44 + float32Array.length * 2);
    const view = new DataView(buffer);

    // WAV ヘッダー
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    const sampleRate = 16000; // VADのサンプルレート
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + float32Array.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(36, 'data');
    view.setUint32(40, float32Array.length * 2, true);

    // PCM データ
    let offset = 44;
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }
}

export default new VoiceRecorder();
