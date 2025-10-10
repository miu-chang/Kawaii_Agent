#!/usr/bin/env python3
"""
Simplified RVC inference using official VC module
"""

import sys
import os
from pathlib import Path

# RVC WebUI path
RVC_DIR = Path(__file__).parent / "rvc-webui"
sys.path.insert(0, str(RVC_DIR))
os.environ["weight_root"] = str(Path(__file__).parent.parent / "public" / "rvc-models")

from configs.config import Config
from infer.modules.vc.modules import VC
from scipy.io import wavfile

def convert_voice(input_path, model_name, output_path):
    """Simple RVC conversion using official modules"""
    try:
        # Model paths
        if model_name == 'つくよみちゃん':
            model_file = "01 つくよみちゃん公式RVCモデル 通常1.pth"
        elif model_name == 'あみたろ':
            model_file = "AMITARO-natural.pth"
        else:
            raise ValueError(f"Unknown model: {model_name}")

        print(f"[RVC] Initializing...", file=sys.stderr)

        # Initialize config
        config = Config()
        config.device = "cpu"
        config.is_half = False

        # Initialize VC
        vc = VC(config)

        print(f"[RVC] Loading model: {model_file}", file=sys.stderr)

        # Load model
        vc.get_vc(model_file)

        print(f"[RVC] Converting: {input_path}", file=sys.stderr)

        # Convert
        tgt_sr, audio_opt = vc.vc_single(
            sid=0,
            input_audio_path=input_path,
            f0_up_key=0,
            f0_file=None,
            f0_method="harvest",
            file_index="",
            file_index2="",
            index_rate=0.66,
            filter_radius=3,
            resample_sr=0,
            rms_mix_rate=1,
            protect=0.33
        )

        print(f"[RVC] Saving: {output_path}", file=sys.stderr)

        # Save
        wavfile.write(output_path, tgt_sr, audio_opt)

        print(f"[RVC] Conversion complete", file=sys.stderr)
        print(output_path)

    except Exception as e:
        print(f"[RVC ERROR] {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python vc_infer_simple.py <input> <model_name> <output>", file=sys.stderr)
        sys.exit(1)

    convert_voice(sys.argv[1], sys.argv[2], sys.argv[3])
