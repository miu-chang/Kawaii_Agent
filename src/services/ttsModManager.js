/**
 * TTS Mod Manager
 * TTSモッドのインポート、保存、管理を行う
 */

const DB_NAME = 'KawaiiAgentTTSMods';
const DB_VERSION = 1;
const STORE_NAME = 'ttsMods';

class TTSModManager {
  constructor() {
    this.db = null;
    this.loadedMods = new Map();
  }

  /**
   * データベース初期化
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          objectStore.createIndex('name', 'name', { unique: false });
          objectStore.createIndex('author', 'author', { unique: false });
        }
      };
    });
  }

  /**
   * Zipファイルからモッドをインポート
   */
  async importMod(zipFile) {
    if (!this.db) {
      await this.init();
    }

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(zipFile);

    // manifest.json読み込み
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      throw new Error('manifest.jsonが見つかりません');
    }

    const manifestText = await manifestFile.async('text');
    const manifest = JSON.parse(manifestText);

    // 必須フィールド検証
    if (!manifest.id || !manifest.name || !manifest.version || !manifest.type) {
      throw new Error('manifest.jsonに必須フィールドが不足しています');
    }

    if (manifest.type !== 'tts') {
      throw new Error(`無効なModタイプ: ${manifest.type}`);
    }

    // tts-service.js読み込み
    const serviceFile = zip.file('tts-service.js');
    if (!serviceFile) {
      throw new Error('tts-service.jsが見つかりません');
    }

    const serviceCode = await serviceFile.async('text');

    // voices.json読み込み（オプション）
    let voices = null;
    const voicesFile = zip.file('voices.json');
    if (voicesFile) {
      const voicesText = await voicesFile.async('text');
      voices = JSON.parse(voicesText);
    }

    // icon.png読み込み（オプション）
    let iconDataUrl = null;
    const iconFile = zip.file('icon.png');
    if (iconFile) {
      const iconBlob = await iconFile.async('blob');
      iconDataUrl = await this.blobToDataUrl(iconBlob);
    }

    // Mod情報をDBに保存
    const modData = {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      author: manifest.author || 'Unknown',
      description: manifest.description || '',
      languages: manifest.languages || ['ja'],
      serviceCode: serviceCode,
      voices: voices,
      icon: iconDataUrl,
      installedAt: new Date().toISOString()
    };

    await this.saveMod(modData);

    console.log('[TTS Mod] Imported:', manifest.name);
    return modData;
  }

  /**
   * Modをデータベースに保存
   */
  async saveMod(modData) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.put(modData);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * インストール済みMod一覧を取得
   */
  async getInstalledMods() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * インストール済みMod一覧を取得（メタデータのみ）
   * listMods() は getInstalledMods() のエイリアス
   */
  async listMods() {
    if (!this.db) {
      await this.init();
    }

    const mods = await this.getInstalledMods();

    // 表示用にメタデータを整形
    return mods.map(mod => ({
      id: mod.id,
      metadata: {
        name: mod.name,
        version: mod.version,
        author: mod.author,
        description: mod.description,
        languages: mod.languages
      },
      icon: mod.icon,
      installedAt: mod.installedAt
    }));
  }

  /**
   * Modを読み込んでTTSサービスインスタンスを作成
   */
  async loadMod(modId) {
    if (!this.db) {
      await this.init();
    }

    if (this.loadedMods.has(modId)) {
      return this.loadedMods.get(modId);
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.get(modId);

      request.onsuccess = () => {
        const modData = request.result;
        if (!modData) {
          reject(new Error(`Mod not found: ${modId}`));
          return;
        }

        try {
          // サービスコードを実行してクラスを取得
          const serviceModule = this.evaluateServiceCode(modData.serviceCode);
          const serviceInstance = new serviceModule(modData.voices);

          this.loadedMods.set(modId, serviceInstance);
          resolve(serviceInstance);
        } catch (error) {
          reject(error);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * サービスコードを評価してクラスを取得
   */
  evaluateServiceCode(code) {
    // セキュリティ注意: ユーザーがインポートしたコードを実行
    // 本番環境では署名検証などを追加すべき
    const module = { exports: {} };
    const func = new Function('module', 'exports', code);
    func(module, module.exports);
    return module.exports.default || module.exports;
  }

  /**
   * Modを削除
   */
  async deleteMod(modId) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.delete(modId);

      request.onsuccess = () => {
        this.loadedMods.delete(modId);
        console.log('[TTS Mod] Deleted:', modId);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * BlobをData URLに変換
   */
  blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

// シングルトンインスタンス
const ttsModManager = new TTSModManager();

export default ttsModManager;
