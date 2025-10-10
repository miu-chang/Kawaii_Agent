// RVC推論サービス（Electron + Python）
// RVCモデルで声質変換

class RvcInferenceService {
  constructor() {
    this.isReady = false;
    this.useElectronIPC = typeof window !== 'undefined' && window.electronAPI;
  }

  async initialize() {
    try {
      console.log('[RVC Inference] Initializing RVC service...');

      // Electron環境チェック
      if (!this.useElectronIPC) {
        console.warn('[RVC Inference] Not running in Electron environment');
        console.warn('[RVC Inference] RVC conversion will be skipped');
        this.isReady = true;
        return true;
      }

      console.log('[RVC Inference] Electron IPC available');
      this.isReady = true;
      console.log('[RVC Inference] Service ready');
      return true;

    } catch (error) {
      console.error('[RVC Inference] Initialization failed:', error);
      this.isReady = false;
      return false;
    }
  }


  /**
   * 音声を変換（メイン処理）
   */
  async convertVoice(audioBlob, character) {
    console.log('[RVC Inference] Converting voice...');
    console.log('[RVC Inference] Target character:', character);

    // Electron IPC利用不可の場合は元の音声を返す
    if (!this.useElectronIPC) {
      console.warn('[RVC Inference] Electron IPC not available, skipping conversion');
      return audioBlob;
    }

    try {
      // BlobをArrayBufferに変換
      const arrayBuffer = await audioBlob.arrayBuffer();

      // Electron main processでRVC変換を実行
      console.log('[RVC Inference] Calling Electron IPC for RVC conversion...');
      const convertedBuffer = await window.electronAPI.convertRVC(arrayBuffer, character);

      // ArrayBufferをBlobに変換
      const convertedBlob = new Blob([convertedBuffer], { type: 'audio/wav' });

      console.log('[RVC Inference] Conversion complete');
      return convertedBlob;

    } catch (error) {
      console.error('[RVC Inference] Conversion failed:', error);
      console.warn('[RVC Inference] Returning original audio');
      // エラー時は元の音声を返す
      return audioBlob;
    }
  }

  destroy() {
    this.isReady = false;
  }
}

// シングルトンインスタンス
const rvcInferenceService = new RvcInferenceService();
export default rvcInferenceService;
