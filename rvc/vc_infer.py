#!/usr/bin/env python3
"""
Minimal RVC Inference Implementation
Based on RVC WebUI but without fairseq dependency
"""

import sys
import torch
import numpy as np
import librosa
import soundfile as sf
from pathlib import Path

# torchaudioでHuBERTをロード（fairseq不要）
try:
    import torchaudio
    TORCHAUDIO_AVAILABLE = True
except ImportError:
    TORCHAUDIO_AVAILABLE = False
    print("[RVC] Warning: torchaudio not available", file=sys.stderr)

# fairseqのダミーモジュールを作成（バックアップ用）
class DummyFairseq:
    class data:
        class dictionary:
            class Dictionary:
                pass

sys.modules['fairseq'] = DummyFairseq()
sys.modules['fairseq.data'] = DummyFairseq.data
sys.modules['fairseq.data.dictionary'] = DummyFairseq.data.dictionary

# Add RVC WebUI to path
RVC_DIR = Path(__file__).parent / "rvc-webui"
sys.path.insert(0, str(RVC_DIR))

try:
    from infer.lib.infer_pack.models import (
        SynthesizerTrnMs256NSFsid,
        SynthesizerTrnMs256NSFsid_nono,
        SynthesizerTrnMs768NSFsid,
        SynthesizerTrnMs768NSFsid_nono,
    )
except ImportError as e:
    print(f"[RVC] Warning: Could not import RVC models: {e}", file=sys.stderr)
    SynthesizerTrnMs256NSFsid = None

import pyworld as pw
import torchcrepe

MODEL_DIR = Path(__file__).parent.parent / "public" / "rvc-models"
HUBERT_PATH = Path(__file__).parent / "models" / "hubert_base.pt"

class HuBERTModel:
    """HuBERT feature extractor"""

    def __init__(self, model_path):
        self.device = "cpu"

        # torchaudioでHuBERTをロードを試みる
        if TORCHAUDIO_AVAILABLE:
            try:
                print(f"[RVC] Attempting to load HuBERT with torchaudio...", file=sys.stderr)
                # Torchaudioを使ってHuBERTをロード
                bundle = torchaudio.pipelines.HUBERT_BASE
                self.model = bundle.get_model().to(self.device)
                self.model.eval()
                self.is_state_dict = False
                print(f"[RVC] HuBERT loaded successfully with torchaudio", file=sys.stderr)
                return
            except Exception as e:
                print(f"[RVC] torchaudio load failed: {e}, falling back to MFCC", file=sys.stderr)

        # フォールバック: MFCCを使用
        print(f"[RVC] Using MFCC features (HuBERT unavailable)", file=sys.stderr)
        self.model = None
        self.is_state_dict = True

    def extract_features(self, audio, sr=16000):
        """Extract features from audio"""
        # Resample to 16kHz if needed
        if sr != 16000:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=16000)
            sr = 16000

        # HuBERTモデルが利用できない場合、MFCCで代替
        if self.is_state_dict or self.model is None:
            # MFCCで代替（256次元に合わせる）
            mfcc = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=40, n_fft=1024, hop_length=160)
            # 256次元にパディング
            feats = np.pad(mfcc.T, ((0, 0), (0, 256 - mfcc.shape[0])), mode='constant')
            return feats

        # Convert to tensor
        waveform = torch.from_numpy(audio).float().unsqueeze(0).to(self.device)

        # Extract features with HuBERT
        with torch.no_grad():
            features, _ = self.model.extract_features(waveform)
            # 最後の層の特徴量を使用
            feats = features[-1]

        return feats.squeeze(0).cpu().numpy()


class RVCInference:
    """RVC Voice Conversion Inference"""

    def __init__(self, model_path, hubert_path):
        self.device = "cpu"

        # Load checkpoint
        checkpoint = torch.load(model_path, map_location=self.device, weights_only=False)

        # Parse sample rate (handle "40k" format)
        sr_raw = checkpoint.get("sr", 40000)
        if isinstance(sr_raw, str):
            if sr_raw.endswith('k'):
                self.sr = int(float(sr_raw[:-1]) * 1000)
            else:
                self.sr = int(sr_raw)
        else:
            self.sr = int(sr_raw)

        self.f0 = int(checkpoint.get("f0", 1))
        self.config = checkpoint.get("config", [])
        self.version = checkpoint.get("version", "v1")

        print(f"[RVC] Model SR: {self.sr}, F0: {self.f0}, Version: {self.version}", file=sys.stderr)

        # Initialize HuBERT
        self.hubert = HuBERTModel(hubert_path)

        # Load model weights
        if SynthesizerTrnMs256NSFsid is None:
            raise ImportError("RVC model classes not available")

        # Select model architecture based on config
        # config[4]がHuBERT次元数（256 or 768）
        if len(self.config) >= 5:
            hubert_dim = self.config[4]
            print(f"[RVC] HuBERT dimension from config: {hubert_dim}", file=sys.stderr)

            if hubert_dim == 768:
                if self.f0 == 1:
                    self.net = SynthesizerTrnMs768NSFsid(*self.config, is_half=False)
                else:
                    self.net = SynthesizerTrnMs768NSFsid_nono(*self.config, is_half=False)
            else:
                if self.f0 == 1:
                    self.net = SynthesizerTrnMs256NSFsid(*self.config, is_half=False)
                else:
                    self.net = SynthesizerTrnMs256NSFsid_nono(*self.config, is_half=False)
        else:
            # Default
            if self.f0 == 1:
                self.net = SynthesizerTrnMs256NSFsid(*self.config, is_half=False)
            else:
                self.net = SynthesizerTrnMs256NSFsid_nono(*self.config, is_half=False)

        # Load weights
        self.net.load_state_dict(checkpoint["weight"], strict=False)
        self.net.eval().to(self.device)

        print(f"[RVC] Model loaded successfully", file=sys.stderr)

    def extract_f0(self, audio, sr, f0_min=50, f0_max=1100):
        """Extract F0 using PyWorld"""
        audio = audio.astype(np.float64)
        # PyWorld APIは f0_floor と f0_ceil を使用
        f0, t = pw.dio(audio, sr, f0_floor=f0_min, f0_ceil=f0_max, frame_period=10)
        f0 = pw.stonemask(audio, f0, t, sr)
        return f0

    def convert(self, audio_path, f0_up_key=0):
        """Convert voice"""
        print(f"[RVC] Loading audio: {audio_path}", file=sys.stderr)

        # Load audio
        audio, sr = librosa.load(audio_path, sr=16000, mono=True)

        print(f"[RVC] Audio loaded: {len(audio)} samples ({len(audio)/sr:.2f}s)", file=sys.stderr)

        # Extract HuBERT features
        print(f"[RVC] Extracting HuBERT features...", file=sys.stderr)
        feats = self.hubert.extract_features(audio, sr)

        print(f"[RVC] Features extracted: {feats.shape}", file=sys.stderr)

        # Extract F0 if needed
        if self.f0 == 1:
            print(f"[RVC] Extracting F0...", file=sys.stderr)
            f0 = self.extract_f0(audio, sr)
            print(f"[RVC] F0 extracted: {f0.shape}", file=sys.stderr)
        else:
            f0 = None

        # Prepare input
        feats_tensor = torch.from_numpy(feats).float().unsqueeze(0).to(self.device)  # (1, T, C)

        if f0 is not None:
            # F0の時間次元をfeatsに合わせる
            from scipy import interpolate
            f0_len = len(f0)
            feats_len = feats.shape[0]

            if f0_len != feats_len:
                # 線形補間でリサイズ
                f0_interp = interpolate.interp1d(
                    np.arange(f0_len), f0, kind='linear', fill_value='extrapolate'
                )
                f0 = f0_interp(np.linspace(0, f0_len - 1, feats_len))

            # Pitch shift
            f0 *= pow(2, f0_up_key / 12)

            # pitchf: 連続的なF0値 (Float)
            pitchf = torch.from_numpy(f0).float().unsqueeze(0).to(self.device)  # (1, T)

            # pitch: F0を量子化して整数インデックスに変換 (Long)
            # F0範囲を0-255にマッピング（RVCの一般的な量子化）
            f0_mel = 1127 * np.log(1 + f0 / 700)  # HzをMelに変換
            f0_mel[f0_mel > 0] = (f0_mel[f0_mel > 0] - f0_mel[f0_mel > 0].min()) * 254 / (
                f0_mel[f0_mel > 0].max() - f0_mel[f0_mel > 0].min()
            ) + 1
            f0_mel[f0_mel <= 1] = 1
            f0_mel[f0_mel > 255] = 255
            pitch = torch.from_numpy(f0_mel).long().unsqueeze(0).to(self.device)  # (1, T)

            print(f"[RVC] pitch tensor shape: {pitch.shape}, pitchf shape: {pitchf.shape}", file=sys.stderr)
        else:
            pitch = None
            pitchf = None

        # Inference
        print(f"[RVC] Running model inference...", file=sys.stderr)
        print(f"[RVC] feats_tensor shape: {feats_tensor.shape}", file=sys.stderr)

        # Speaker ID (0 = default)
        sid = torch.LongTensor([0]).to(self.device)

        with torch.no_grad():
            if pitch is not None:
                # RVC v2のinferシグネチャ確認
                phone_lengths = torch.LongTensor([feats_tensor.shape[1]]).to(self.device)

                # inferメソッドを呼び出し
                audio_out = self.net.infer(
                    feats_tensor,     # phone: (B, T, C)
                    phone_lengths,    # phone_lengths: (B,)
                    pitch,            # pitch: (B, T) Long - 量子化されたピッチ
                    pitchf,           # nsff0/pitchf: (B, T) Float - 連続F0値
                    sid               # sid: (B,)
                )[0][0, 0].data.cpu().float().numpy()  # output, mask, (z, z_p, m_p, logs_p)
            else:
                phone_lengths = torch.LongTensor([feats_tensor.shape[1]]).to(self.device)
                audio_out = self.net.infer(
                    feats_tensor,
                    phone_lengths,
                    sid
                )[0][0, 0].data.cpu().float().numpy()

        print(f"[RVC] Inference complete, output shape: {audio_out.shape}", file=sys.stderr)

        return audio_out, self.sr


def convert_voice(input_path, model_name, output_path):
    """Main conversion function"""
    try:
        # Model paths
        if model_name == 'つくよみちゃん':
            model_path = MODEL_DIR / "01 つくよみちゃん公式RVCモデル 通常1.pth"
        elif model_name == 'あみたろ':
            model_path = MODEL_DIR / "AMITARO-natural.pth"
        else:
            raise ValueError(f"Unknown model: {model_name}")

        if not model_path.exists():
            raise FileNotFoundError(f"Model not found: {model_path}")

        if not HUBERT_PATH.exists():
            raise FileNotFoundError(f"HuBERT model not found: {HUBERT_PATH}")

        # Initialize inference
        rvc = RVCInference(model_path, HUBERT_PATH)

        # Convert
        audio_out, sr_out = rvc.convert(input_path, f0_up_key=0)

        # Save
        print(f"[RVC] Saving output: {output_path}", file=sys.stderr)
        sf.write(output_path, audio_out, int(sr_out))

        print(f"[RVC] Conversion complete", file=sys.stderr)
        print(output_path)

    except Exception as e:
        print(f"[RVC ERROR] {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python vc_infer.py <input> <model_name> <output>", file=sys.stderr)
        sys.exit(1)

    convert_voice(sys.argv[1], sys.argv[2], sys.argv[3])
