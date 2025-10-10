#!/usr/bin/env python3
"""
Parler-TTS音声生成スクリプト
日本語対応の可愛い声で音声合成
"""

import sys
import torch
from parler_tts import ParlerTTSForConditionalGeneration
from transformers import AutoTokenizer
import soundfile as sf
from rubyinserter import add_ruby

def generate_speech(text, output_path, description=None):
    """
    音声を生成

    Args:
        text: 読み上げるテキスト
        output_path: 出力ファイルパス
        description: 話者の特徴（オプション）
    """
    try:
        # デバイス設定
        device = "cuda:0" if torch.cuda.is_available() else "cpu"
        print(f"[Parler-TTS] Using device: {device}", file=sys.stderr)

        # モデルとトークナイザーのロード
        print("[Parler-TTS] Loading model...", file=sys.stderr)
        model = ParlerTTSForConditionalGeneration.from_pretrained(
            "2121-8/japanese-parler-tts-mini"
        ).to(device)

        prompt_tokenizer = AutoTokenizer.from_pretrained(
            "2121-8/japanese-parler-tts-mini",
            subfolder="prompt_tokenizer"
        )

        description_tokenizer = AutoTokenizer.from_pretrained(
            "2121-8/japanese-parler-tts-mini",
            subfolder="description_tokenizer"
        )

        print("[Parler-TTS] Model loaded successfully", file=sys.stderr)

        # デフォルトの説明文（可愛い女性の声）
        if description is None:
            description = "A female speaker with a slightly high-pitched voice delivers her words quite expressively, in a very confined sounding environment with clear audio quality. She speaks very fast."

        # テキストにルビを追加
        print(f"[Parler-TTS] Processing text: {text}", file=sys.stderr)
        prompt = add_ruby(text)
        print(f"[Parler-TTS] Text with ruby: {prompt}", file=sys.stderr)

        # トークナイズ
        input_ids = description_tokenizer(description, return_tensors="pt").input_ids.to(device)
        prompt_input_ids = prompt_tokenizer(prompt, return_tensors="pt").input_ids.to(device)

        # 音声生成
        print("[Parler-TTS] Generating speech...", file=sys.stderr)
        generation = model.generate(
            input_ids=input_ids,
            prompt_input_ids=prompt_input_ids
        )

        # 音声を保存
        audio_arr = generation.cpu().numpy().squeeze()
        sampling_rate = model.config.sampling_rate

        print(f"[Parler-TTS] Saving audio to: {output_path}", file=sys.stderr)
        print(f"[Parler-TTS] Sampling rate: {sampling_rate}", file=sys.stderr)
        print(f"[Parler-TTS] Audio shape: {audio_arr.shape}", file=sys.stderr)

        sf.write(output_path, audio_arr, sampling_rate)

        print("[Parler-TTS] Generation complete", file=sys.stderr)
        print(output_path)  # 標準出力に出力パスを返す

    except Exception as e:
        print(f"[Parler-TTS ERROR] {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 generate.py <text> <output_path> [description]", file=sys.stderr)
        sys.exit(1)

    text = sys.argv[1]
    output_path = sys.argv[2]
    description = sys.argv[3] if len(sys.argv) > 3 else None

    generate_speech(text, output_path, description)
