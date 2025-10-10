# VRMAアニメーションフォルダ

このフォルダにMixamoから変換したVRMAファイルを配置してください。

## ファイル命名規則

- `idle_01.vrma` - アイドル（待機）モーション
- `wave.vrma` - 手を振るモーション
- `happy.vrma` - 喜ぶモーション
- など

## 変換方法

詳細は `/MIXAMO_SETUP.md` を参照してください。

1. Mixamoからアニメーションをダウンロード（FBX形式、Without Skin）
2. BlenderでFBX → BVH変換
3. VRM Consortium Webツール（https://vrm-c.github.io/bvh2vrma/）でBVH → VRMA変換
4. このフォルダに配置

## 使い方

アプリケーションから以下のようにアクセスできます：

```javascript
// VRMAアニメーションをロード
await vrmaManager.loadAnimation('idle', '/animations/idle_01.vrma');

// アニメーションを再生
vrmaManager.play('idle', { loop: true });
```
