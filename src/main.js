require('dotenv').config();
const { app, BrowserWindow, ipcMain, screen, session, desktopCapturer } = require('electron');
const path = require('path');

// 安全なログ出力関数（EPIPEエラー対策）
function safeLog(...args) {
  try {
    console.log(...args);
  } catch (err) {
    // EPIPEエラーを無視（標準出力パイプが切断されている場合）
    if (err.code !== 'EPIPE') {
      // EPIPE以外のエラーは再スロー
      throw err;
    }
  }
}

// 複数ウィンドウ管理用の配列
let windows = [];
let windowIdCounter = 0;

// セキュアなファイルシステムアクセスのためのパス検証（ブラックリスト方式）
const os = require('os');

// macOS/Linux用のブロックパス（ホームディレクトリ相対）
const BLOCKED_PATHS_HOME = [
  '.ssh',                    // SSH秘密鍵
  '.aws',                    // AWS認証情報
  '.config/gcloud',          // Google Cloud認証情報
  '.docker',                 // Docker認証情報
  '.kube',                   // Kubernetes設定
  '.gnupg',                  // GPG鍵
  'Library/Keychains',       // macOS キーチェーン
  'AppData/Roaming/.ssh',    // Windows SSH鍵
  'AppData/Roaming/.aws',    // Windows AWS認証情報
  'AppData/Local/.docker',   // Windows Docker
  'AppData/Roaming/.kube'    // Windows Kubernetes
];

// システムディレクトリのブロックパス（絶対パス）
const BLOCKED_PATHS_SYSTEM = [
  '/etc',           // Unix システム設定
  '/var',           // Unix システムログ
  '/usr',           // Unix システムファイル
  '/bin',           // Unix システムバイナリ
  '/sbin',          // Unix システムバイナリ
  '/System',        // macOS システム
  '/private',       // macOS プライベート
  '/Library',       // macOS システムライブラリ
  'C:\\Windows',    // Windows システム
  'C:\\Program Files', // Windows プログラム
  'C:\\Program Files (x86)', // Windows プログラム (32bit)
  'C:\\ProgramData' // Windows プログラムデータ
];

function isPathAllowed(filePath) {
  try {
    // ホームディレクトリの展開
    let fullPath = filePath;
    if (filePath.startsWith('~')) {
      fullPath = path.join(os.homedir(), filePath.slice(1));
    }

    const resolved = path.resolve(fullPath).toLowerCase();

    // ホームディレクトリ配下のブロックパスをチェック
    for (const blocked of BLOCKED_PATHS_HOME) {
      const blockedPath = path.join(os.homedir(), blocked).toLowerCase();
      if (resolved.startsWith(blockedPath)) {
        return false;
      }
    }

    // システムディレクトリのブロックパスをチェック
    for (const blocked of BLOCKED_PATHS_SYSTEM) {
      const blockedPath = path.resolve(blocked).toLowerCase();
      if (resolved.startsWith(blockedPath)) {
        return false;
      }
    }

    return true;
  } catch (error) {
    return false;
  }
}

function createWindow() {
  // ディスプレイのサイズを取得
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

  // 既存のウィンドウ数に応じてオフセットを計算
  const offset = windows.length * 50;

  const newWindow = new BrowserWindow({
    width: 500,
    height: 750,
    x: width - 550 - offset,
    y: height - 800 - offset,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: true,
    minWidth: 300,
    minHeight: 400,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      partition: `persist:window-${windowIdCounter}` // ウィンドウごとに独立したセッション
    },
    // macOS専用の透明化オプション
    ...(process.platform === 'darwin' && {
      vibrancy: 'ultra-dark',
      visualEffectState: 'active'
    })
  });

  // ウィンドウIDを割り当て
  const windowId = windowIdCounter++;
  windows.push({ id: windowId, window: newWindow });

  // 開発環境とプロダクション環境で読み込むファイルを切り替え
  if (process.env.NODE_ENV === 'development') {
    newWindow.loadURL('http://localhost:8080');
  } else {
    newWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // ウィンドウを常に最前面に保つ（デフォルトは通常レベル）
  newWindow.setAlwaysOnTop(true, 'screen-saver');
  newWindow.setVisibleOnAllWorkspaces(true);

  // macOS用の追加設定（最初のウィンドウのみDockを非表示）
  if (process.platform === 'darwin' && windows.length === 1) {
    app.dock.hide();
  }

  // ウィンドウのクリック透過設定（必要に応じて）
  newWindow.setIgnoreMouseEvents(false);

  // セッションのキャッシュ設定を確認
  const ses = session.fromPartition(`persist:window-${windowId}`);
  console.log(`Window ${windowId} Session path:`, ses.getStoragePath());

  // ウィンドウが閉じられた時に配列から削除
  newWindow.on('closed', () => {
    windows = windows.filter(w => w.id !== windowId);
    console.log(`Window ${windowId} closed. Remaining windows: ${windows.length}`);
  });

  console.log(`Created window ${windowId}. Total windows: ${windows.length}`);
  return newWindow;
}

// Electronの初期化完了後にウィンドウを作成
app.whenReady().then(() => {
  // キャッシュディレクトリの確保
  console.log('User data path:', app.getPath('userData'));

  // CSP (Content Security Policy) ヘッダーを設定
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " + // Three.jsなどで必要
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: blob: https:; " +
          "font-src 'self' data:; " +
          "connect-src 'self' https: wss:; " + // API接続用
          "media-src 'self' blob:; " +
          "worker-src 'self' blob:;"
        ]
      }
    });
  });

  // マイクアクセス権限を許可
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true); // マイクとカメラの権限を許可
    } else {
      callback(false);
    }
  });

  createWindow();
});

// すべてのウィンドウが閉じられたときの処理
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPCハンドラ（レンダラープロセスとの通信用）
ipcMain.handle('toggle-click-through', (event, clickThrough) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    window.setIgnoreMouseEvents(clickThrough, { forward: true });
  }
});

ipcMain.handle('set-window-level', (event, { aboveFullscreen, alwaysOnTop }) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    // alwaysOnTopがfalseの場合は最前面表示を無効化
    if (alwaysOnTop === false) {
      window.setAlwaysOnTop(false);
      safeLog(`[Main] Window level set to: normal (alwaysOnTop: false)`);
    } else {
      // 全画面アプリの上に表示する場合は 'pop-up-menu' レベル、そうでなければ 'screen-saver' レベル
      const level = aboveFullscreen ? 'pop-up-menu' : 'screen-saver';
      window.setAlwaysOnTop(true, level);
      safeLog(`[Main] Window level set to: ${level} (aboveFullscreen: ${aboveFullscreen})`);
    }
  }
});

ipcMain.handle('minimize-window', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    window.minimize();
  }
});

ipcMain.handle('close-window', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    window.close();
  }
});

// 新しいウィンドウを作成するハンドラ
ipcMain.handle('create-new-window', () => {
  createWindow();
});

// NewsAPI用のハンドラ（メインプロセスでAPIリクエストを実行）
ipcMain.handle('fetch-news', async (event, { category, keyword, count }) => {
  try {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
      return { error: 'ニュース機能を使用するには、.envファイルにNEWS_API_KEYを設定してください。\n無料で取得できます: https://newsapi.org/' };
    }

    const baseUrl = 'https://newsapi.org/v2/top-headlines';
    const params = new URLSearchParams({
      country: 'jp',
      category: category || 'general',
      pageSize: count || 5,
      apiKey: apiKey
    });

    if (keyword) {
      params.set('q', keyword);
    }

    const url = `${baseUrl}?${params}`;
    console.log(`[Main Process] Fetching news: ${url.replace(apiKey, 'API_KEY_HIDDEN')}`);

    const https = require('https');
    const urlObj = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'KawaiiAgent/1.0.0'
      }
    };

    const response = await new Promise((resolve, reject) => {
      https.get(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });

    if (response.status === 'error') {
      return { error: `NewsAPI エラー: ${response.message}` };
    }

    if (!response.articles || response.articles.length === 0) {
      return { error: '該当するニュースが見つかりませんでした。' };
    }

    // 記事を整形
    const articles = response.articles.slice(0, count || 5).map((article, index) => {
      return `${index + 1}. ${article.title}\n   ${article.description || '説明なし'}\n   出典: ${article.source.name}`;
    });

    return { success: true, result: articles.join('\n\n') };
  } catch (error) {
    console.error('[Main Process] News fetch error:', error);
    return { error: `ニュースの取得に失敗しました: ${error.message}` };
  }
});

// 画面キャプチャ用のハンドラ
ipcMain.handle('capture-screen', async (event) => {
  try {
    const window = BrowserWindow.fromWebContents(event.sender);

    // ウィンドウを一時的に非表示にする
    if (window) {
      window.hide();
      // 少し待ってから画面をキャプチャ
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    });

    // ウィンドウを再表示
    if (window) {
      window.show();
    }

    if (sources.length === 0) {
      return { error: '画面のキャプチャに失敗しました' };
    }

    // プライマリディスプレイの画像を取得
    const primarySource = sources[0];
    const thumbnailDataURL = primarySource.thumbnail.toDataURL();

    // data:image/png;base64,の部分を除いてbase64文字列のみを返す
    const base64Data = thumbnailDataURL.replace(/^data:image\/\w+;base64,/, '');

    console.log('[Main Process] Screen captured successfully');
    return { success: true, image: base64Data };
  } catch (error) {
    console.error('[Main Process] Screen capture error:', error);
    return { error: `画面キャプチャに失敗しました: ${error.message}` };
  }
});

// ファイル読み取りハンドラ
ipcMain.handle('read-file', async (event, filePath, encoding = 'utf-8') => {
  try {
    // パス検証
    if (!isPathAllowed(filePath)) {
      return { error: 'アクセスが許可されていないディレクトリです。Documents、Downloads、Desktopフォルダのみアクセス可能です。' };
    }

    const fs = require('fs').promises;

    // ホームディレクトリの展開
    let fullPath = filePath;
    if (filePath.startsWith('~')) {
      fullPath = path.join(os.homedir(), filePath.slice(1));
    }

    // encodingがnullの場合はバイナリとして読み込む
    const content = encoding ? await fs.readFile(fullPath, encoding) : await fs.readFile(fullPath);
    console.log(`[Main Process] File read: ${fullPath}`);
    return { success: true, content };
  } catch (error) {
    console.error('[Main Process] Read file error:', error);
    return { error: error.message };
  }
});

// ファイル書き込みハンドラ
ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');

    // ホームディレクトリの展開
    let fullPath = filePath;
    if (filePath.startsWith('~')) {
      fullPath = path.join(require('os').homedir(), filePath.slice(1));
    }

    await fs.writeFile(fullPath, content, 'utf-8');
    console.log(`[Main Process] File written: ${fullPath}`);
    return { success: true };
  } catch (error) {
    console.error('[Main Process] Write file error:', error);
    return { error: error.message };
  }
});

// ファイル一覧取得ハンドラ
ipcMain.handle('list-files', async (event, dirPath) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const os = require('os');

    // パスが指定されていない場合はホームディレクトリ
    let fullPath = dirPath || os.homedir();
    if (fullPath.startsWith('~')) {
      fullPath = path.join(os.homedir(), fullPath.slice(1));
    }

    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    const files = entries.map(entry => ({
      name: entry.name,
      type: entry.isDirectory() ? 'dir' : 'file',
      path: path.join(fullPath, entry.name)
    }));

    console.log(`[Main Process] Listed ${files.length} files in: ${fullPath}`);
    return { success: true, path: fullPath, files };
  } catch (error) {
    console.error('[Main Process] List files error:', error);
    return { error: error.message };
  }
});

// アプリケーション起動ハンドラ
ipcMain.handle('open-app', async (event, target) => {
  try {
    const { shell } = require('electron');

    // URLの場合は外部ブラウザで開く
    if (target.startsWith('http://') || target.startsWith('https://')) {
      await shell.openExternal(target);
      return { success: true, message: `URLを開きました: ${target}` };
    }

    // macOSのアプリ起動マッピング
    const appMap = {
      'chrome': 'Google Chrome',
      'safari': 'Safari',
      'firefox': 'Firefox',
      'vscode': 'Visual Studio Code',
      'finder': 'Finder',
      'terminal': 'Terminal',
      'mail': 'Mail',
      'calendar': 'Calendar',
      'notes': 'Notes',
      'music': 'Music',
      'photos': 'Photos'
    };

    const appName = appMap[target.toLowerCase()] || target;

    // macOSの場合はopen コマンドで起動
    if (process.platform === 'darwin') {
      const { execFile } = require('child_process');
      return new Promise((resolve) => {
        // execFileを使用して安全に実行
        execFile('open', ['-a', appName], (error) => {
          if (error) {
            console.error('[Main Process] Open app error:', error);
            resolve({ error: `アプリの起動に失敗しました: ${error.message}` });
          } else {
            console.log(`[Main Process] Opened app: ${appName}`);
            resolve({ success: true, message: `${appName}を起動しました` });
          }
        });
      });
    } else {
      return { error: 'このプラットフォームではアプリ起動はサポートされていません' };
    }
  } catch (error) {
    console.error('[Main Process] Open app error:', error);
    return { error: error.message };
  }
});

// システムリソース取得ハンドラ
ipcMain.handle('get-system-resources', async () => {
  try {
    const os = require('os');

    // CPU使用率の計算（簡易版）
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (let type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const cpuUsage = (100 - ~~(100 * totalIdle / totalTick)).toFixed(1);

    // メモリ情報
    const totalMemory = (os.totalmem() / (1024 ** 3)).toFixed(2);
    const freeMemory = (os.freemem() / (1024 ** 3)).toFixed(2);
    const usedMemory = (totalMemory - freeMemory).toFixed(2);
    const memoryUsage = ((usedMemory / totalMemory) * 100).toFixed(1);

    console.log(`[Main Process] System resources: CPU ${cpuUsage}%, Memory ${memoryUsage}%`);

    return {
      success: true,
      cpuUsage,
      totalMemory,
      freeMemory,
      memoryUsage,
      platform: os.platform(),
      arch: os.arch()
    };
  } catch (error) {
    console.error('[Main Process] Get system resources error:', error);
    return { error: error.message };
  }
});

// 外部URLを開く
ipcMain.handle('open-external', async (event, url) => {
  try {
    const { shell } = require('electron');
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('[Main Process] Open external error:', error);
    return { error: error.message };
  }
});

// RVC音声変換
ipcMain.handle('convert-rvc', async (event, audioBlob, modelName) => {
  const { exec } = require('child_process');
  const fs = require('fs');
  const os = require('os');
  const crypto = require('crypto');

  return new Promise((resolve, reject) => {
    try {
      // 一時ファイルを作成
      const tempDir = os.tmpdir();
      const tempId = crypto.randomBytes(16).toString('hex');
      const inputPath = path.join(tempDir, `rvc_input_${tempId}.mp3`);
      const outputPath = path.join(tempDir, `rvc_output_${tempId}.wav`);

      // Blobを一時ファイルに保存
      const buffer = Buffer.from(audioBlob);
      fs.writeFileSync(inputPath, buffer);

      // 実行ファイルのパスを決定
      let rvcExecutable;

      if (app.isPackaged) {
        // パッケージ化されている場合：バンドルされたバイナリを使用
        const platform = process.platform;
        const binaryName = platform === 'win32' ? 'rvc_convert.exe' : 'rvc_convert';
        rvcExecutable = path.join(process.resourcesPath, 'rvc', binaryName);
      } else {
        // 開発環境：vc_infer.pyを使用
        rvcExecutable = path.join(__dirname, '../rvc/vc_infer.py');
      }

      console.log('[RVC] Executing conversion...');

      // execFileを使用して安全に実行
      const args = app.isPackaged
        ? [inputPath, modelName, outputPath]
        : [inputPath, modelName, outputPath];

      const command = app.isPackaged ? rvcExecutable : 'python3';
      const fullArgs = app.isPackaged ? args : [rvcExecutable].concat(args);

      const { execFile } = require('child_process');
      execFile(command, fullArgs, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        // 入力ファイルをクリーンアップ
        try {
          fs.unlinkSync(inputPath);
        } catch (e) {
          console.warn('[RVC] Failed to delete input file:', e.message);
        }

        if (error) {
          console.error('[RVC] Conversion error:', stderr);
          reject(new Error(`RVC conversion failed: ${stderr}`));
          return;
        }

        try {
          // 出力ファイルを読み込み
          const outputBuffer = fs.readFileSync(outputPath);

          // 出力ファイルをクリーンアップ
          try {
            fs.unlinkSync(outputPath);
          } catch (e) {
            console.warn('[RVC] Failed to delete output file:', e.message);
          }

          // ArrayBufferとして返す
          resolve(outputBuffer.buffer.slice(
            outputBuffer.byteOffset,
            outputBuffer.byteOffset + outputBuffer.byteLength
          ));
        } catch (readError) {
          console.error('[RVC] Failed to read output file:', readError);
          reject(new Error(`Failed to read RVC output: ${readError.message}`));
        }
      });
    } catch (err) {
      console.error('[RVC] Unexpected error:', err);
      reject(err);
    }
  });
});

// Parler-TTSサーバー管理
let parlerTTSServerProcess = null;

// Parler-TTSサーバー起動
ipcMain.handle('start-parler-tts-server', async (event) => {
  const { spawn } = require('child_process');

  return new Promise((resolve, reject) => {
    try {
      if (parlerTTSServerProcess) {
        console.log('[Parler-TTS] Server already running');
        return resolve({ success: true });
      }

      // Pythonスクリプトのパス
      const scriptPath = path.join(__dirname, '../parler_tts/server.py');

      console.log('[Parler-TTS] Starting server...');

      // サーバーを起動
      parlerTTSServerProcess = spawn('python3', [scriptPath], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let serverReady = false;

      // 標準出力を監視
      parlerTTSServerProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('[Parler-TTS Server]', output);

        // サーバーが起動完了したか確認
        if (output.includes('Running on') || output.includes('Starting server on')) {
          if (!serverReady) {
            serverReady = true;
            console.log('[Parler-TTS] Server ready');
            resolve({ success: true });
          }
        }
      });

      // エラー出力を監視
      parlerTTSServerProcess.stderr.on('data', (data) => {
        const output = data.toString();
        console.log('[Parler-TTS Server stderr]', output);

        // stderrにも起動メッセージが出る場合がある
        if (output.includes('Running on') || output.includes('Starting server on')) {
          if (!serverReady) {
            serverReady = true;
            console.log('[Parler-TTS] Server ready');
            resolve({ success: true });
          }
        }
      });

      // プロセス終了時
      parlerTTSServerProcess.on('close', (code) => {
        console.log('[Parler-TTS] Server process exited with code', code);
        parlerTTSServerProcess = null;

        if (!serverReady) {
          reject(new Error(`Server failed to start (exit code: ${code})`));
        }
      });

      // タイムアウト（60秒）
      setTimeout(() => {
        if (!serverReady) {
          if (parlerTTSServerProcess) {
            parlerTTSServerProcess.kill();
            parlerTTSServerProcess = null;
          }
          reject(new Error('Server startup timeout'));
        }
      }, 60000);

    } catch (err) {
      console.error('[Parler-TTS] Unexpected error:', err);
      reject(err);
    }
  });
});

// Parler-TTSサーバー停止
ipcMain.handle('stop-parler-tts-server', async (event) => {
  return new Promise((resolve) => {
    try {
      if (parlerTTSServerProcess) {
        console.log('[Parler-TTS] Stopping server...');
        parlerTTSServerProcess.kill();
        parlerTTSServerProcess = null;
        console.log('[Parler-TTS] Server stopped');
      }
      resolve({ success: true });
    } catch (err) {
      console.error('[Parler-TTS] Error stopping server:', err);
      resolve({ success: false, error: err.message });
    }
  });
});
