#!/usr/bin/env python3
"""
RVC Voice Conversion using official RVC WebUI code
Usage: python convert_rvc.py <input_audio> <model_name> <output_path>
"""

import sys
import os
from pathlib import Path

# RVC WebUIのパスを追加
RVC_WEBUI_DIR = Path(__file__).parent / "rvc-webui"
sys.path.insert(0, str(RVC_WEBUI_DIR))

from scipy.io import wavfile
from configs.config import Config
from infer.modules.vc.modules import VC

# RVCモデルディレクトリ
MODEL_DIR = Path(__file__).parent.parent / "public" / "rvc-models"

def convert_voice_rvc(input_path, model_name, output_path):
    """
    RVC voice conversion using official RVC WebUI code

    Args:
        input_path: 入力音声ファイルパス
        model_name: モデル名（'つくよみちゃん' or 'あみたろ'）
        output_path: 出力音声ファイルパス
    """
    try:
        # モデルファイルパスを取得
        if model_name == 'つくよみちゃん':
            # 通常1を使用
            model_path = MODEL_DIR / "01 つくよみちゃん公式RVCモデル 通常1.pth"
        elif model_name == 'あみたろ':
            model_path = MODEL_DIR / "AMITARO-natural.pth"
        else:
            raise ValueError(f"Unknown model: {model_name}")

        if not model_path.exists():
            raise FileNotFoundError(f"Model file not found: {model_path}")

        print(f"[RVC] Using official RVC WebUI inference", file=sys.stderr)
        print(f"[RVC] Model: {model_path}", file=sys.stderr)
        print(f"[RVC] Input: {input_path}", file=sys.stderr)

        # Config初期化
        config = Config()
        config.device = "cpu"  # CPUを使用（Macの場合）
        config.is_half = False  # FP32を使用

        print(f"[RVC] Initializing VC module...", file=sys.stderr)

        # VC初期化
        vc = VC(config)

        print(f"[RVC] Loading model...", file=sys.stderr)

        # モデルをロード
        vc.get_vc(str(model_path))

        print(f"[RVC] Running inference...", file=sys.stderr)

        # 推論実行
        _, wav_opt = vc.vc_single(
            sid=0,
            input_audio_path=input_path,
            f0_up_key=0,  # ピッチ変更なし
            f0_file=None,
            f0_method="harvest",  # F0抽出方法
            file_index="",  # インデックスファイルなし
            file_index2="",
            index_rate=0.66,
            filter_radius=3,
            resample_sr=0,
            rms_mix_rate=1,
            protect=0.33,
        )

        print(f"[RVC] Inference complete", file=sys.stderr)
        print(f"[RVC] Saving output: {output_path}", file=sys.stderr)

        # 出力を保存
        wavfile.write(output_path, wav_opt[0], wav_opt[1])

        print(f"[RVC] Conversion complete: {output_path}", file=sys.stderr)
        print(output_path)  # stdoutに出力パスを返す

    except Exception as e:
        print(f"[RVC ERROR] {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python convert_rvc.py <input_audio> <model_name> <output_path>", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    model_name = sys.argv[2]
    output_path = sys.argv[3]

    convert_voice_rvc(input_path, model_name, output_path)
