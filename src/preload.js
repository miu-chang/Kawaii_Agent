const { contextBridge, ipcRenderer } = require('electron');

// レンダラープロセスで使用できるAPIを公開
contextBridge.exposeInMainWorld('electronAPI', {
  toggleClickThrough: (clickThrough) => ipcRenderer.invoke('toggle-click-through', clickThrough),
  setWindowLevel: (aboveFullscreen) => ipcRenderer.invoke('set-window-level', aboveFullscreen),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  createNewWindow: () => ipcRenderer.invoke('create-new-window'),

  // ファイル選択ダイアログ用（VRMファイルの読み込みに使用）
  selectFile: () => ipcRenderer.invoke('select-file'),

  // AI対話用のAPI（将来的に実装）
  sendMessage: (message) => ipcRenderer.invoke('send-message', message),
  onResponse: (callback) => ipcRenderer.on('ai-response', callback),

  // NewsAPI用（メインプロセスでAPIリクエストを実行）
  fetchNews: (params) => ipcRenderer.invoke('fetch-news', params),

  // 画面キャプチャ用
  captureScreen: () => ipcRenderer.invoke('capture-screen'),

  // ファイル操作用
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  writeFile: (path, content) => ipcRenderer.invoke('write-file', path, content),
  listFiles: (path) => ipcRenderer.invoke('list-files', path),

  // アプリ起動用
  openApp: (target) => ipcRenderer.invoke('open-app', target),

  // システムリソース取得用
  getSystemResources: () => ipcRenderer.invoke('get-system-resources'),

  // 外部URLを開く
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Parler-TTSサーバー管理
  startParlerTTSServer: () => ipcRenderer.invoke('start-parler-tts-server'),
  stopParlerTTSServer: () => ipcRenderer.invoke('stop-parler-tts-server'),

  // VRoid Hub OAuth
  onVRoidOAuthCode: (callback) => {
    ipcRenderer.on('vroid-oauth-code', (event, code) => callback(code));
  },
  onVRoidOAuthError: (callback) => {
    ipcRenderer.on('vroid-oauth-error', (event, error) => callback(error));
  },

  // Google OAuth
  onGoogleOAuthCode: (callback) => {
    ipcRenderer.on('google-oauth-code', (event, code) => callback(code));
  },
  onGoogleOAuthError: (callback) => {
    ipcRenderer.on('google-oauth-error', (event, error) => callback(error));
  }
});
