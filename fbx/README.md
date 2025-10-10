# FBXアニメーションファイル

Mixamoからダウンロードしたアニメーションファイルです。

## ダウンロード済みアニメーション

- **Dwarf Idle.fbx** / **Dwarf Idle-2.fbx** - アイドル（待機）
- **Look Around.fbx** - キョロキョロ見回す
- **Waving.fbx** / **Waving-2.fbx** - 手を振る
- **Excited.fbx** - 興奮
- **Thinking.fbx** - 考える
- **Joyful Jump.fbx** - 喜びのジャンプ
- **Standing Clap.fbx** / **Standing Clap-2.fbx** - 拍手
- **Happy Walk.fbx** - 楽しそうに歩く
- **Walking.fbx** - 歩く
- **Turning.fbx** - 振り向く
- **Drunk Walking Turn.fbx** - ふらふら歩く
- **Typing.fbx** - タイピング
- **Singing.fbx** - 歌う

## 次のステップ：BVHへの変換

### 手動変換（各ファイルごと）

1. Blenderを起動
2. デフォルトのキューブを削除（X → Delete）
3. File → Import → FBX (.fbx) でファイルを選択
4. インポートしたアーマチュアを選択
5. File → Export → Motion Capture (.bvh)
6. 同じファイル名で保存（例：`Waving.bvh`）
7. 次のファイルへ（Blenderを再起動して繰り返し）

### 一括変換（Blender Pythonスクリプト）

`convert_fbx_to_bvh.py` スクリプトを使用して一括変換できます。

```bash
blender --background --python convert_fbx_to_bvh.py
```

## BVH → VRMA変換

BVHファイルができたら：

1. https://vrm-c.github.io/bvh2vrma/ にアクセス
2. BVHファイルをドラッグ&ドロップ
3. 自動的にVRMAファイルがダウンロードされる
4. `public/animations/` フォルダに配置

## ファイル名ガイドライン

変換後のVRMAファイルは以下の命名規則を推奨：

- `idle_01.vrma`, `idle_02.vrma` - アイドル系
- `wave.vrma`, `wave_02.vrma` - ジェスチャー
- `excited.vrma` - 感情表現
- `walk.vrma` - 移動系
- `typing.vrma` - 特殊アクション
