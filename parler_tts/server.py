#!/usr/bin/env python3
"""
Parler-TTS HTTPサーバー
モデルを常駐させて高速な音声生成を実現
"""

import sys
import torch
from parler_tts import ParlerTTSForConditionalGeneration
from transformers import AutoTokenizer
import soundfile as sf
from rubyinserter import add_ruby
from flask import Flask, request, jsonify, send_file
import tempfile
import os

app = Flask(__name__)

# グローバル変数
model = None
prompt_tokenizer = None
description_tokenizer = None
device = None

def initialize_model():
    """モデルを初期化"""
    global model, prompt_tokenizer, description_tokenizer, device

    print("[Parler-TTS Server] Initializing...", file=sys.stderr)

    # デバイス設定
    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    print(f"[Parler-TTS Server] Using device: {device}", file=sys.stderr)

    # モデルとトークナイザーのロード
    print("[Parler-TTS Server] Loading model...", file=sys.stderr)
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

    print("[Parler-TTS Server] Model loaded successfully", file=sys.stderr)

@app.route('/health', methods=['GET'])
def health():
    """ヘルスチェック"""
    return jsonify({"status": "ok"})

@app.route('/generate', methods=['POST'])
def generate():
    """音声生成エンドポイント"""
    try:
        data = request.json
        text = data.get('text', '')
        description = data.get('description', 'A female speaker with a slightly high-pitched voice delivers her words quite expressively, in a very confined sounding environment with clear audio quality. She speaks very fast.')

        if not text:
            return jsonify({"error": "Text is required"}), 400

        print(f"[Parler-TTS Server] Generating speech for: {text}", file=sys.stderr)

        # テキストにルビを追加
        prompt = add_ruby(text)

        # トークナイズ
        input_ids = description_tokenizer(description, return_tensors="pt").input_ids.to(device)
        prompt_input_ids = prompt_tokenizer(prompt, return_tensors="pt").input_ids.to(device)

        # 音声生成
        generation = model.generate(
            input_ids=input_ids,
            prompt_input_ids=prompt_input_ids
        )

        # 音声を保存
        audio_arr = generation.cpu().numpy().squeeze()
        sampling_rate = model.config.sampling_rate

        # 一時ファイルに保存
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
        sf.write(temp_file.name, audio_arr, sampling_rate)
        temp_file.close()

        print(f"[Parler-TTS Server] Generation complete: {temp_file.name}", file=sys.stderr)

        # ファイルを返す
        return send_file(temp_file.name, mimetype='audio/wav', as_attachment=True, download_name='output.wav')

    except Exception as e:
        print(f"[Parler-TTS Server ERROR] {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # モデルを初期化
    initialize_model()

    # サーバー起動
    print("[Parler-TTS Server] Starting server on http://localhost:5050", file=sys.stderr)
    app.run(host='127.0.0.1', port=5050, debug=False)
