import os
import tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import pipeline
import torch

app = Flask(__name__)
CORS(app)

# Whisperモデルのロード（初回は数GB DLするので時間がかかる）
print("Loading Whisper model...")
device = "mps" if torch.backends.mps.is_available() else "cpu"
print(f"Using device: {device}")

# whisper-large-v3を使用（日本語対応、高精度）
# large-v3は重いので、最初は base か small を試すのも良い
# model_name = "openai/whisper-base"  # 軽量版
model_name = "openai/whisper-large-v3"  # 高精度版

try:
    transcriber = pipeline(
        "automatic-speech-recognition",
        model=model_name,
        device=device,
        torch_dtype=torch.float16 if device == "mps" else torch.float32
    )
    print("Whisper model loaded successfully!")
except Exception as e:
    print(f"Error loading model: {e}")
    print("Falling back to base model...")
    transcriber = pipeline(
        "automatic-speech-recognition",
        model="openai/whisper-base",
        device=device
    )

@app.route('/transcribe', methods=['POST'])
def transcribe():
    """音声ファイルを受け取り、テキストに変換"""
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400

        audio_file = request.files['audio']

        # 一時ファイルに保存
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
            audio_file.save(tmp_file.name)
            tmp_path = tmp_file.name

        try:
            # Whisperで音声認識
            # generate_kwargsで言語を指定（日本語）
            result = transcriber(
                tmp_path,
                generate_kwargs={
                    "language": "ja",
                    "task": "transcribe",
                    "temperature": 0.0
                }
            )

            text = result['text']
            print(f"Transcription result: {text}")

            return jsonify({
                'success': True,
                'text': text
            })

        finally:
            # 一時ファイルを削除
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    except Exception as e:
        print(f"Error during transcription: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health():
    """ヘルスチェック"""
    return jsonify({'status': 'ok', 'model': model_name})

if __name__ == '__main__':
    port = 5001  # VITSは5000なので、5001を使う
    print(f"Starting Whisper server on http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
