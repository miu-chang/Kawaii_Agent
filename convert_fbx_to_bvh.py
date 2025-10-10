"""
Blender Pythonスクリプト：FBXファイルを一括でBVHに変換

使い方：
blender --background --python convert_fbx_to_bvh.py

または：
blender を起動 → Scripting タブ → このファイルを開いて実行
"""

import bpy
import os
from pathlib import Path

# プロジェクトルートディレクトリ
project_root = Path(__file__).parent
fbx_dir = project_root / "fbx"
bvh_dir = project_root / "bvh"

# BVH出力ディレクトリを作成
bvh_dir.mkdir(exist_ok=True)

print(f"FBX directory: {fbx_dir}")
print(f"BVH output directory: {bvh_dir}")

# FBXファイルを検索
fbx_files = list(fbx_dir.glob("*.fbx"))
print(f"Found {len(fbx_files)} FBX files")

# 各FBXファイルを変換
for fbx_file in fbx_files:
    print(f"\n{'='*60}")
    print(f"Processing: {fbx_file.name}")
    print(f"{'='*60}")

    # シーンをクリア
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # FBXをインポート
    try:
        print(f"Importing FBX: {fbx_file}")
        bpy.ops.import_scene.fbx(filepath=str(fbx_file))
        print("Import successful")
    except Exception as e:
        print(f"Error importing {fbx_file.name}: {e}")
        continue

    # アーマチュアを検索
    armature = None
    for obj in bpy.data.objects:
        if obj.type == 'ARMATURE':
            armature = obj
            break

    if not armature:
        print(f"No armature found in {fbx_file.name}, skipping")
        continue

    print(f"Found armature: {armature.name}")

    # アーマチュアを選択
    bpy.ops.object.select_all(action='DESELECT')
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature

    # BVHファイルパス
    bvh_file = bvh_dir / f"{fbx_file.stem}.bvh"

    # BVHをエクスポート
    try:
        print(f"Exporting to BVH: {bvh_file}")
        bpy.ops.export_anim.bvh(
            filepath=str(bvh_file),
            check_existing=False,
            global_scale=1.0,
            frame_start=1,
            frame_end=250,
            rotate_mode='NATIVE',
            root_transform_only=False
        )
        print(f"✓ Successfully converted: {fbx_file.name} → {bvh_file.name}")
    except Exception as e:
        print(f"Error exporting {fbx_file.name}: {e}")
        continue

print(f"\n{'='*60}")
print("Conversion complete!")
print(f"{'='*60}")
print(f"Converted files are in: {bvh_dir}")
print(f"\nNext step: Convert BVH to VRMA using:")
print("https://vrm-c.github.io/bvh2vrma/")
