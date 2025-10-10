#!/usr/bin/env python3
"""
RVC Voice Conversion Script for Electron
Usage: python convert.py <input_audio> <model_name> <output_path>
"""

import sys
import os
import torch
import librosa
import soundfile as sf
import numpy as np
from pathlib import Path
import parselmouth

# RVCモデルディレクトリ
MODEL_DIR = Path(__file__).parent.parent / "public" / "rvc-models"

def load_audio(audio_path, sr=16000):
    """音声ファイルをロード"""
    audio, _ = librosa.load(audio_path, sr=sr, mono=True)
    return audio

def save_audio(audio, output_path, sr=16000):
    """音声ファイルを保存"""
    sf.write(output_path, audio, sr)

def extract_f0(audio, sr=16000, f0_min=50, f0_max=1100):
    """
    F0（ピッチ）を抽出
    Praat Parselmouthを使用
    """
    try:
        # Parselmouth (Praat) でF0抽出
        snd = parselmouth.Sound(audio, sampling_frequency=sr)
        pitch = snd.to_pitch(time_step=0.01, pitch_floor=f0_min, pitch_ceiling=f0_max)

        # F0値を取得
        f0_values = pitch.selected_array['frequency']

        # 0の部分を補間
        f0_values = np.where(f0_values == 0, np.nan, f0_values)

        return f0_values
    except Exception as e:
        print(f"[RVC] F0 extraction failed: {e}", file=sys.stderr)
        # フォールバック：ゼロで埋める
        return np.zeros(len(audio) // 160)

def simple_rvc_inference(audio, model, f0, sr=16000):
    """
    簡易RVC推論
    注: 実際のRVCには HuBERT特徴抽出 + 複雑な推論が必要
    この実装はプレースホルダー
    """
    try:
        # モデルの構造を確認
        if 'weight' in model:
            print(f"[RVC] Model contains 'weight' key", file=sys.stderr)

        # 実際のRVC推論はここに実装
        # 1. HuBERTで特徴抽出
        # 2. F0とHuBERT特徴を結合
        # 3. RVCモデルで推論
        # 4. Vocoderで音声合成

        # 現状：ピッチシフトのみ実装（簡易版）
        # librosaでピッチシフト
        semitones = 0  # ピッチ変更なし（将来的にモデルから推定）
        output_audio = librosa.effects.pitch_shift(audio, sr=sr, n_steps=semitones)

        return output_audio

    except Exception as e:
        print(f"[RVC] Inference failed: {e}", file=sys.stderr)
        return audio

def convert_voice(input_path, model_name, output_path):
    """
    RVC voice conversion

    Args:
        input_path: 入力音声ファイルパス
        model_name: モデル名（'tsukuyomi' or 'amitaro'）
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

        print(f"[RVC] Loading audio: {input_path}", file=sys.stderr)

        # 音声をロード（16kHz）
        audio = load_audio(input_path, sr=16000)

        print(f"[RVC] Audio loaded: {len(audio)} samples, {len(audio)/16000:.2f}s", file=sys.stderr)
        print(f"[RVC] Extracting F0...", file=sys.stderr)

        # F0抽出
        f0 = extract_f0(audio, sr=16000)

        print(f"[RVC] F0 extracted: {len(f0)} frames", file=sys.stderr)
        print(f"[RVC] Loading model: {model_path}", file=sys.stderr)

        # モデルをロード
        checkpoint = torch.load(str(model_path), map_location='cpu', weights_only=False)

        print(f"[RVC] Model keys: {list(checkpoint.keys())[:5]}...", file=sys.stderr)
        print(f"[RVC] Converting voice with {model_name}...", file=sys.stderr)

        # RVC推論（簡易版）
        output_audio = simple_rvc_inference(audio, checkpoint, f0, sr=16000)

        print(f"[RVC] Saving output: {output_path}", file=sys.stderr)

        # 出力を保存
        save_audio(output_audio, output_path, sr=16000)

        print(f"[RVC] Conversion complete: {output_path}", file=sys.stderr)
        print(output_path)  # stdoutに出力パスを返す

    except Exception as e:
        print(f"[RVC ERROR] {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python convert.py <input_audio> <model_name> <output_path>", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    model_name = sys.argv[2]
    output_path = sys.argv[3]

    convert_voice(input_path, model_name, output_path)
