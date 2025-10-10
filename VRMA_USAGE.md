# VRMAアニメーション使用ガイド

desktop-mate-aiアプリケーションでMixamoアニメーション（VRMA形式）を使用する完全ガイドです。

## 概要

このアプリケーションは、Mixamoの高品質なアニメーションを使用できるようにVRMAファイルのサポートを実装しています。

## セットアップ手順

### 1. Mixamoアニメーションの入手と変換

詳細は `MIXAMO_SETUP.md` を参照してください。

簡単な流れ：
1. Mixamo.com からアニメーションをダウンロード（FBX、Without Skin）
2. Blender で FBX → BVH に変換
3. VRM Consortium の Web ツールで BVH → VRMA に変換
4. `public/animations/` フォルダに配置

### 2. ファイル配置

変換したVRMAファイルを以下のディレクトリに配置：

```
desktop-mate-ai/
  public/
    animations/
      idle.vrma          # アイドルモーション
      wave.vrma          # 手を振るモーション
      happy.vrma         # 喜ぶモーション
      walking.vrma       # 歩くモーション
      ...
```

## アプリケーション内での使用方法

### テストボタンを使う（開発時）

1. `src/App.jsx` の304行目を編集：
   ```javascript
   {false && vrmaManagerRef.current && (
   ```
   を
   ```javascript
   {true && vrmaManagerRef.current && (
   ```
   に変更

2. アプリを再起動

3. 左上に表示される「VRMA Test」ボタンをクリック

4. `public/animations/idle.vrma` が読み込まれて再生されます

### コードから直接使う

VRMAAnimationManagerは以下のAPIを提供します：

```javascript
// VRMAファイルを読み込んで登録
await vrmaManager.loadAnimation('idle', '/animations/idle.vrma');

// アニメーションを再生
vrmaManager.play('idle', {
  loop: true,              // ループ再生
  fadeInDuration: 0.3,     // フェードイン時間
  fadeOutDuration: 0.3,    // フェードアウト時間
});

// アニメーションを停止
vrmaManager.stop(0.5);  // 0.5秒でフェードアウト

// 登録済みアニメーション一覧を取得
const names = vrmaManager.getAnimationNames();

// 再生中かどうか確認
const playing = vrmaManager.isPlaying();
```

## 実装の詳細

### アーキテクチャ

1. **VRMALoader** (`src/utils/vrmaLoader.js`)
   - VRMAファイルを読み込んでThree.js AnimationClipに変換
   - VRMAnimationLoaderPluginを使用

2. **VRMAAnimationManager** (`src/utils/vrmaLoader.js`)
   - 複数のVRMAアニメーションを管理
   - AnimationMixerでアニメーション再生を制御
   - フェードイン/アウトをサポート

3. **VRMViewer** (`src/components/VRMViewer.jsx`)
   - VRM読み込み時にVRMAAnimationManagerを初期化
   - useFrameループでアニメーションを更新

4. **App** (`src/App.jsx`)
   - VRMAManagerをrefで保持
   - テスト機能を提供

### 更新フロー

```
VRMModel.load()
  → VRMAAnimationManager.new()
  → onMotionReady callback
  → App stores vrmaManagerRef

useFrame loop:
  → vrmaManager.update(delta)
  → AnimationMixer.update(delta)
```

## 次のステップ

### アイドルアニメーションとの統合

現在のアイドルアニメーション（`src/utils/vrmIdleAnimations.js`）をVRMAファイルベースに置き換えることができます：

```javascript
// IdleAnimationManagerの代わりにVRMAAnimationManagerを使用
async loadIdleAnimations() {
  await vrmaManager.loadAnimation('idle_01', '/animations/idle_01.vrma');
  await vrmaManager.loadAnimation('idle_02', '/animations/idle_02.vrma');
  await vrmaManager.loadAnimation('walk', '/animations/walk.vrma');
}

// ランダムに再生
const animations = ['idle_01', 'idle_02', 'walk'];
const random = animations[Math.floor(Math.random() * animations.length)];
vrmaManager.play(random, { loop: true });
```

### ジェスチャーとの統合

感情やジェスチャーに応じてVRMAアニメーションを再生：

```javascript
// App.jsxのhandleSendMessage内
switch (emotion) {
  case 'happy':
    if (vrmaManagerRef.current) {
      await vrmaManagerRef.current.loadAnimation('happy', '/animations/happy.vrma');
      vrmaManagerRef.current.play('happy', { loop: false });
    }
    break;
  case 'sad':
    // ...
}
```

## トラブルシューティング

### アニメーションが再生されない

1. ブラウザコンソールでエラーを確認
2. VRMAファイルが正しいパスに配置されているか確認
3. VRMモデルとアニメーションのボーン構造が互換性があるか確認

### コンソールに "No VRM animations found" エラー

- BVH → VRMA変換が正しく行われていない可能性
- VRM Consortium のツールで再変換を試す

### アニメーションがカクカクする

- VRMAファイルのフレームレートが低い可能性
- Mixamoダウンロード時に30fpsまたは60fpsを選択

## おすすめのMixamoアニメーション

### アイドル系
- Idle
- Breathing Idle
- Looking Around
- Standing Idle

### ジェスチャー系
- Waving
- Happy
- Excited
- Thinking
- Clapping

### 移動系
- Walking (In Place)
- Turning
- Sitting

## ライセンス

Mixamoアニメーションは商用利用可能ですが、アニメーションファイル単体での再配布は禁止されています。
アプリケーションに組み込んで配布することは問題ありません。

詳細はMixamo利用規約を参照してください。
