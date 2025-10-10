// IndexedDB helper for storing large motion and model data

const DB_NAME = 'DesktopMateAI';
const DB_VERSION = 2;
const STORE_IMPORTED_MOTIONS = 'importedMotions';
const STORE_FAVORITE_MOTIONS = 'favoriteMotions';
const STORE_IMPORTED_MODELS = 'importedModels';
const STORE_FAVORITE_MODELS = 'favoriteModels';

/**
 * データベースを開く
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // importedMotions ストア
      if (!db.objectStoreNames.contains(STORE_IMPORTED_MOTIONS)) {
        const store = db.createObjectStore(STORE_IMPORTED_MOTIONS, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // favoriteMotions ストア
      if (!db.objectStoreNames.contains(STORE_FAVORITE_MOTIONS)) {
        db.createObjectStore(STORE_FAVORITE_MOTIONS, { keyPath: 'id' });
      }

      // importedModels ストア
      if (!db.objectStoreNames.contains(STORE_IMPORTED_MODELS)) {
        const store = db.createObjectStore(STORE_IMPORTED_MODELS, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // favoriteModels ストア
      if (!db.objectStoreNames.contains(STORE_FAVORITE_MODELS)) {
        db.createObjectStore(STORE_FAVORITE_MODELS, { keyPath: 'id' });
      }
    };
  });
}

/**
 * インポートモーションを保存
 */
export async function saveImportedMotions(motions) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IMPORTED_MOTIONS, 'readwrite');
    const store = tx.objectStore(STORE_IMPORTED_MOTIONS);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };

    // 既存データをクリア
    store.clear();

    // 新しいデータを保存（各モーションに一意のIDを付与）
    for (let i = 0; i < motions.length; i++) {
      const motion = { ...motions[i], id: `motion_${motions[i].timestamp}_${i}` };
      store.put(motion);
    }
  });
}

/**
 * インポートモーションを読み込み
 */
export async function loadImportedMotions() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_IMPORTED_MOTIONS, 'readonly');
    const store = tx.objectStore(STORE_IMPORTED_MOTIONS);

    const motions = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();
    return Array.isArray(motions) ? motions : [];
  } catch (error) {
    console.error('[IndexedDB] Failed to load imported motions:', error);
    return [];
  }
}

/**
 * お気に入りモーションを保存
 */
export async function saveFavoriteMotions(favorites) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FAVORITE_MOTIONS, 'readwrite');
    const store = tx.objectStore(STORE_FAVORITE_MOTIONS);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };

    // 既存データをクリア
    store.clear();

    // 新しいデータを保存（各お気に入りに一意のIDを付与）
    for (let i = 0; i < favorites.length; i++) {
      const fav = favorites[i];
      const id = fav.imported ? `imported_${fav.name}_${fav.timestamp}` : fav.url;
      store.put({ ...fav, id });
    }
  });
}

/**
 * お気に入りモーションを読み込み
 */
export async function loadFavoriteMotions() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_FAVORITE_MOTIONS, 'readonly');
    const store = tx.objectStore(STORE_FAVORITE_MOTIONS);

    const favorites = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();
    return Array.isArray(favorites) ? favorites : [];
  } catch (error) {
    console.error('[IndexedDB] Failed to load favorite motions:', error);
    return [];
  }
}

/**
 * インポートモデルを保存
 */
export async function saveImportedModels(models) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IMPORTED_MODELS, 'readwrite');
    const store = tx.objectStore(STORE_IMPORTED_MODELS);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };

    // 既存データをクリア
    store.clear();

    // 新しいデータを保存（各モデルに一意のIDを付与）
    for (let i = 0; i < models.length; i++) {
      const model = { ...models[i], id: `model_${models[i].timestamp}_${i}` };
      store.put(model);
    }
  });
}

/**
 * インポートモデルを読み込み
 */
export async function loadImportedModels() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_IMPORTED_MODELS, 'readonly');
    const store = tx.objectStore(STORE_IMPORTED_MODELS);

    const models = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();
    return Array.isArray(models) ? models : [];
  } catch (error) {
    console.error('[IndexedDB] Failed to load imported models:', error);
    return [];
  }
}

/**
 * お気に入りモデルを保存
 */
export async function saveFavoriteModels(favorites) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FAVORITE_MODELS, 'readwrite');
    const store = tx.objectStore(STORE_FAVORITE_MODELS);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };

    // 既存データをクリア
    store.clear();

    // 新しいデータを保存（各お気に入りに一意のIDを付与）
    for (let i = 0; i < favorites.length; i++) {
      const fav = favorites[i];
      const id = fav.imported ? `imported_${fav.name}_${fav.timestamp}` : fav.path || fav.url;
      store.put({ ...fav, id });
    }
  });
}

/**
 * お気に入りモデルを読み込み
 */
export async function loadFavoriteModels() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_FAVORITE_MODELS, 'readonly');
    const store = tx.objectStore(STORE_FAVORITE_MODELS);

    const favorites = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();
    return Array.isArray(favorites) ? favorites : [];
  } catch (error) {
    console.error('[IndexedDB] Failed to load favorite models:', error);
    return [];
  }
}
