# Mixamoアニメーションのセットアップ手順

このガイドでは、Mixamoから高品質なアニメーションをダウンロードして、desktop-mate-aiで使えるVRMA形式に変換する方法を説明します。

## 必要なもの

- Mixamoアカウント（無料）：https://www.mixamo.com/
- Blender（無料）：https://www.blender.org/
- VRMコンソーシアムのBVH→VRMA変換ツール（Web）：https://vrm-c.github.io/bvh2vrma/

## 手順

### 1. Mixamoからアニメーションをダウンロード

1. https://www.mixamo.com/ にアクセスしてログイン
2. 左側の「Animations」タブをクリック
3. 検索バーで以下のようなアニメーションを探す：
   - **Idle系**：「idle」「standing」「breathing」
   - **待機系**：「looking around」「casual idle」
   - **ジェスチャー**：「waving」「nodding」「thinking」
   - **感情表現**：「happy」「excited」「sad」
4. 気に入ったアニメーションをクリック
5. 右側の「Download」ボタンをクリック
6. ダウンロード設定：
   - Format: **FBX (.fbx)**
   - Skin: **Without Skin** (重要！)
   - Frame Rate: **30 fps**
7. 「Download」をクリック

### 2. BlenderでFBXをBVHに変換

1. Blenderを起動
2. デフォルトのキューブを削除（X → Delete）
3. File → Import → FBX (.fbx) でダウンロードしたファイルを選択
4. インポートしたアーマチュアを選択
5. File → Export → Motion Capture (.bvh)
6. ファイル名を付けて保存（例：`idle_01.bvh`）

### 3. BVHをVRMAに変換

1. https://vrm-c.github.io/bvh2vrma/ にアクセス
2. BlenderからエクスポートしたBVHファイルをドラッグ&ドロップ
3. 自動的にVRMAファイルがダウンロードされる

### 4. VRMAファイルをアプリに配置

変換したVRMAファイルを以下のディレクトリに配置：
```
desktop-mate-ai/
  public/
    animations/
      idle_01.vrma
      idle_02.vrma
      wave.vrma
      ...
```

## おすすめのアニメーション

### アイドル（待機）モーション
- **Idle** - 基本の立ちポーズ
- **Breathing Idle** - 呼吸する待機モーション
- **Looking Around** - キョロキョロ見回す
- **Standing Idle** - リラックスした立ちポーズ
- **Casual Idle** - カジュアルな待機

### ジェスチャー
- **Waving** - 手を振る
- **Waving (Two Hands)** - 両手を振る
- **Happy** - 喜ぶモーション
- **Excited** - 興奮したモーション
- **Thinking** - 考えるポーズ

### 移動系
- **Walking** - 歩く
- **Walking (In Place)** - その場で歩く
- **Turning** - 振り向く

## ライセンス

Mixamoのアニメーションは以下の条件で使用できます：

✅ **許可されていること**
- 商用利用
- ゲームやアプリへの組み込み
- チーム内での共有
- クレジット表記不要

❌ **禁止されていること**
- アニメーションファイル単体での再配布
- 機械学習モデルのトレーニングデータとしての使用

アプリに組み込んで配布する場合は問題ありません。

## トラブルシューティング

### BVH変換時にエラーが出る

Blenderでエクスポートする際、以下を確認：
- アーマチュアが選択されているか
- スケールが正しいか（1.0推奨）

### VRMAファイルが動作しない

- VRMモデルとボーン構造が互換性があるか確認
- ファイルサイズが大きすぎないか確認（数MB程度が理想）

## 参考リンク

- Mixamo公式：https://www.mixamo.com/
- VRM Animation仕様：https://vrm.dev/vrma/
- three-vrm ドキュメント：https://github.com/pixiv/three-vrm
