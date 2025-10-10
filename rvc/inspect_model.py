#!/usr/bin/env python3
"""
RVCモデルの構造を確認するスクリプト
"""

import sys
import torch
from pathlib import Path

MODEL_DIR = Path(__file__).parent.parent / "public" / "rvc-models"

def inspect_model(model_path):
    """モデルの構造を確認"""
    print(f"Loading: {model_path}")

    checkpoint = torch.load(str(model_path), map_location='cpu', weights_only=False)

    print(f"\n=== Checkpoint Keys ===")
    for key in checkpoint.keys():
        print(f"  - {key}")

    if 'weight' in checkpoint:
        print(f"\n=== Weight Keys (first 20) ===")
        weight_keys = list(checkpoint['weight'].keys())[:20]
        for key in weight_keys:
            print(f"  - {key}")

    if 'config' in checkpoint:
        print(f"\n=== Config ===")
        print(checkpoint['config'])

    if 'params' in checkpoint:
        print(f"\n=== Params ===")
        print(checkpoint['params'])

if __name__ == "__main__":
    model_path = MODEL_DIR / "01 つくよみちゃん公式RVCモデル 通常1.pth"
    inspect_model(model_path)
