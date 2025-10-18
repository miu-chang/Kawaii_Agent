import Meyda from 'meyda';

class VoicePrintService {
  constructor() {
    this.voicePrints = []; // 登録済み声紋（複数サンプル）
    this.threshold = 0.92; // 類似度の閾値（92%以上で本人判定）
    this.minThreshold = 0.80; // 最小類似度閾値（全サンプルでこれ以上必要）
    this.useGMM = false; // GMM使用フラグ（将来の拡張用）
    this.gmmModels = []; // GMMモデル（実験的機能）
    this.loadVoicePrints();
  }

  // 音声から拡張特徴量を抽出（MFCC + ZCR + Centroid + Rolloff + RMS）
  extractFeatures(audioBuffer, sampleRate = 16000) {
    try {
      // AudioBufferからFloat32Arrayを取得
      const audioData = audioBuffer.getChannelData(0);

      // Meydaのバッファサイズ（2のべき乗が必須）
      const bufferSize = 512;
      const hopSize = 256; // オーバーラップ50%

      // 各特徴量のフレーム配列
      const mfccFrames = [];
      const zcrFrames = [];
      const centroidFrames = [];
      const rolloffFrames = [];
      const rmsFrames = [];

      // スライディングウィンドウで特徴量を抽出
      for (let i = 0; i + bufferSize <= audioData.length; i += hopSize) {
        const frame = audioData.slice(i, i + bufferSize);

        // 各特徴量を一度に抽出（sampleRateをオプションで渡す）
        const features = Meyda.extract([
          'mfcc',
          'zcr',
          'spectralCentroid',
          'spectralRolloff',
          'rms'
        ], frame, {
          sampleRate: sampleRate,
          bufferSize: bufferSize
        });

        // 有効な特徴量のみ追加（NaN/Infinityチェック）
        if (features &&
            features.mfcc &&
            Array.isArray(features.mfcc) &&
            isFinite(features.zcr) &&
            isFinite(features.spectralCentroid) &&
            isFinite(features.spectralRolloff) &&
            isFinite(features.rms)) {
          mfccFrames.push(features.mfcc);
          zcrFrames.push(features.zcr);
          centroidFrames.push(features.spectralCentroid);
          rolloffFrames.push(features.spectralRolloff);
          rmsFrames.push(features.rms);
        }
      }

      if (mfccFrames.length === 0) {
        console.error('[VoicePrint] No frames extracted');
        return null;
      }

      // 1. 平均MFCC（13次元）
      const avgMFCC = new Array(mfccFrames[0].length).fill(0);
      for (const frame of mfccFrames) {
        for (let i = 0; i < frame.length; i++) {
          avgMFCC[i] += frame[i];
        }
      }
      for (let i = 0; i < avgMFCC.length; i++) {
        avgMFCC[i] /= mfccFrames.length;
      }

      // 2. 平均ZCR（ゼロ交差率）- 音の高さの指標
      const avgZCR = zcrFrames.reduce((a, b) => a + b, 0) / zcrFrames.length;

      // 3. 平均スペクトル重心 - 音色の明るさ
      const avgCentroid = centroidFrames.reduce((a, b) => a + b, 0) / centroidFrames.length;

      // 4. 平均スペクトルロールオフ - 高周波成分の指標
      const avgRolloff = rolloffFrames.reduce((a, b) => a + b, 0) / rolloffFrames.length;

      // 5. 平均RMS（音量）
      const avgRMS = rmsFrames.reduce((a, b) => a + b, 0) / rmsFrames.length;

      // 周波数系特徴量を正規化（Meydaは44100Hzで計算するため22050で割る）
      const normalizedZCR = avgZCR / 22050;
      const normalizedCentroid = avgCentroid / 22050;
      const normalizedRolloff = avgRolloff / 22050;
      // RMSは0-1なのでそのまま

      // 特徴量を結合: 13 + 1 + 1 + 1 + 1 = 17次元（正規化済み）
      const features = [...avgMFCC, normalizedZCR, normalizedCentroid, normalizedRolloff, avgRMS];

      // NaN/Infinityチェック
      const hasInvalidValue = features.some(v => !isFinite(v));
      if (hasInvalidValue) {
        console.error('[VoicePrint] Features contain NaN or Infinity:', features);
        return null;
      }

      console.log(`[VoicePrint] Extracted ${features.length}-dimensional features (MFCC+ZCR+Centroid+Rolloff+RMS)`);
      console.log(`[VoicePrint] ALL features: [${features.map(v => v.toFixed(3)).join(', ')}]`);

      return features;
    } catch (error) {
      console.error('[VoicePrint] Feature extraction error:', error);
      return null;
    }
  }

  // コサイン類似度を計算
  cosineSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) {
      console.error(`[VoicePrint] Cosine similarity: vector length mismatch (${vec1?.length} vs ${vec2?.length})`);
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    if (norm1 === 0 || norm2 === 0) {
      console.error('[VoicePrint] Cosine similarity: zero norm vector');
      return 0;
    }

    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));

    // デバッグログは一旦削除（ノイズが多い）
    // console.log(`[VoicePrint] Cosine calc - vec1:[${vec1.slice(0, 3).map(v => v.toFixed(2)).join(', ')}...] vec2:[${vec2.slice(0, 3).map(v => v.toFixed(2)).join(', ')}...] => ${(similarity * 100).toFixed(1)}%`);
    // console.log(`[VoicePrint]   dotProduct=${dotProduct.toFixed(2)}, norm1=${norm1.toFixed(2)}, norm2=${norm2.toFixed(2)}, sqrt(norm1)=${Math.sqrt(norm1).toFixed(2)}, sqrt(norm2)=${Math.sqrt(norm2).toFixed(2)}`);

    return similarity;
  }

  // ユークリッド距離を計算（GMM用）
  euclideanDistance(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) {
      return Infinity;
    }

    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
      sum += (vec1[i] - vec2[i]) ** 2;
    }
    return Math.sqrt(sum);
  }

  // 声紋を登録
  registerVoicePrint(audioBuffer, sampleRate = 16000) {
    const features = this.extractFeatures(audioBuffer, sampleRate);

    if (!features) {
      return false;
    }

    this.voicePrints.push(features);
    this.saveVoicePrints();

    console.log(`[VoicePrint] Registered voice print (${this.voicePrints.length} samples, ${features.length}D)`);
    console.log(`[VoicePrint] Registered sample ${this.voicePrints.length} - ALL features: [${features.map(v => v.toFixed(3)).join(', ')}]`);
    return true;
  }

  // 声紋を検証（厳格化版：平均+最小値チェック）
  verifyVoice(audioBuffer, sampleRate = 16000) {
    if (this.voicePrints.length === 0) {
      console.warn('[VoicePrint] No voice prints registered');
      return false;
    }

    const features = this.extractFeatures(audioBuffer, sampleRate);

    if (!features) {
      return false;
    }

    console.log(`[VoicePrint] Verifying against ${this.voicePrints.length} registered voice samples...`);

    // 登録済み全サンプルとの類似度を計算
    const similarities = [];

    for (let i = 0; i < this.voicePrints.length; i++) {
      const voicePrint = this.voicePrints[i];
      const similarity = this.cosineSimilarity(features, voicePrint);
      similarities.push(similarity);
      // console.log(`[VoicePrint] Sample ${i + 1}: ${(similarity * 100).toFixed(1)}%`);
    }

    // 平均類似度を計算
    const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;

    // 最小類似度を確認
    const minSimilarity = Math.min(...similarities);

    // 最大類似度も参考に
    const maxSimilarity = Math.max(...similarities);

    console.log(`[VoicePrint] Similarity - Avg: ${(avgSimilarity * 100).toFixed(1)}%, Min: ${(minSimilarity * 100).toFixed(1)}%, Max: ${(maxSimilarity * 100).toFixed(1)}%`);
    console.log(`[VoicePrint] Threshold - Avg: ${(this.threshold * 100).toFixed(1)}%, Min: ${(this.minThreshold * 100).toFixed(1)}%`);

    // 判定基準（厳格化）：
    // 1. 平均類似度が95%以上
    // 2. かつ最小類似度が80%以上（全サンプルと一定以上似ている）
    const isPassed = avgSimilarity >= this.threshold && minSimilarity >= this.minThreshold;

    if (isPassed) {
      console.log('[VoicePrint] ✅ Voice verified (本人確認OK)');
    } else {
      console.log('[VoicePrint] ❌ Voice not verified (本人でない可能性)');
    }

    return isPassed;
  }

  // GMM検証（実験的機能）
  verifyVoiceWithGMM(audioBuffer, sampleRate = 16000) {
    if (!this.useGMM || this.gmmModels.length === 0) {
      console.warn('[VoicePrint] GMM not enabled or not trained');
      return this.verifyVoice(audioBuffer, sampleRate);
    }

    const features = this.extractFeatures(audioBuffer, sampleRate);

    if (!features) {
      return false;
    }

    // 簡易GMM尤度計算（各ガウス分布との距離の逆数）
    let maxLikelihood = -Infinity;

    for (const gmm of this.gmmModels) {
      let likelihood = 0;
      for (const gaussian of gmm.gaussians) {
        const distance = this.euclideanDistance(features, gaussian.mean);
        // ガウス分布の尤度（簡易版）
        const weight = gaussian.weight || 1.0;
        const variance = gaussian.variance || 1.0;
        likelihood += weight * Math.exp(-distance / (2 * variance));
      }
      maxLikelihood = Math.max(maxLikelihood, likelihood);
    }

    const threshold = 0.5; // GMM用閾値（要調整）
    console.log(`[VoicePrint] GMM Likelihood: ${maxLikelihood.toFixed(3)} (threshold: ${threshold})`);

    return maxLikelihood >= threshold;
  }

  // GMMモデルを訓練（簡易版）
  trainGMM(numComponents = 3) {
    if (this.voicePrints.length < 3) {
      console.warn('[VoicePrint] Not enough samples for GMM training (need at least 3)');
      return false;
    }

    console.log(`[VoicePrint] Training simple GMM with ${numComponents} components...`);

    // K-meansクラスタリング（簡易版）
    const clusters = this.simpleKMeans(this.voicePrints, numComponents);

    // 各クラスタからガウス分布のパラメータを計算
    const gaussians = clusters.map(cluster => {
      // 平均を計算
      const mean = new Array(cluster[0].length).fill(0);
      for (const point of cluster) {
        for (let i = 0; i < point.length; i++) {
          mean[i] += point[i];
        }
      }
      for (let i = 0; i < mean.length; i++) {
        mean[i] /= cluster.length;
      }

      // 分散を計算
      let variance = 0;
      for (const point of cluster) {
        variance += this.euclideanDistance(point, mean) ** 2;
      }
      variance /= cluster.length;

      return {
        mean,
        variance,
        weight: cluster.length / this.voicePrints.length
      };
    });

    this.gmmModels = [{ gaussians }];
    console.log(`[VoicePrint] GMM trained with ${gaussians.length} Gaussian components`);

    return true;
  }

  // 簡易K-meansクラスタリング
  simpleKMeans(data, k, maxIterations = 10) {
    // ランダムに初期中心を選択
    const centroids = [];
    for (let i = 0; i < k; i++) {
      centroids.push([...data[Math.floor(Math.random() * data.length)]]);
    }

    for (let iter = 0; iter < maxIterations; iter++) {
      // 各点を最近接の中心に割り当て
      const clusters = Array(k).fill(null).map(() => []);

      for (const point of data) {
        let minDistance = Infinity;
        let closestCluster = 0;

        for (let i = 0; i < k; i++) {
          const distance = this.euclideanDistance(point, centroids[i]);
          if (distance < minDistance) {
            minDistance = distance;
            closestCluster = i;
          }
        }

        clusters[closestCluster].push(point);
      }

      // 中心を更新
      for (let i = 0; i < k; i++) {
        if (clusters[i].length > 0) {
          const newCentroid = new Array(data[0].length).fill(0);
          for (const point of clusters[i]) {
            for (let j = 0; j < point.length; j++) {
              newCentroid[j] += point[j];
            }
          }
          for (let j = 0; j < newCentroid.length; j++) {
            newCentroid[j] /= clusters[i].length;
          }
          centroids[i] = newCentroid;
        }
      }
    }

    // 最終的なクラスタを返す
    const finalClusters = Array(k).fill(null).map(() => []);
    for (const point of data) {
      let minDistance = Infinity;
      let closestCluster = 0;

      for (let i = 0; i < k; i++) {
        const distance = this.euclideanDistance(point, centroids[i]);
        if (distance < minDistance) {
          minDistance = distance;
          closestCluster = i;
        }
      }

      finalClusters[closestCluster].push(point);
    }

    return finalClusters.filter(cluster => cluster.length > 0);
  }

  // 声紋をクリア
  clearVoicePrints() {
    this.voicePrints = [];
    this.gmmModels = [];
    this.saveVoicePrints();
    console.log('[VoicePrint] Voice prints and GMM models cleared');
  }

  // 登録済みサンプル数を取得
  getRegisteredCount() {
    return this.voicePrints.length;
  }

  // 声紋が登録されているか確認
  isRegistered() {
    return this.voicePrints.length > 0;
  }

  // 閾値を設定
  setThreshold(threshold) {
    this.threshold = Math.max(0, Math.min(1, threshold));
    this.saveVoicePrints();
    console.log(`[VoicePrint] Threshold set to ${(this.threshold * 100).toFixed(1)}%`);
  }

  // 最小閾値を設定
  setMinThreshold(threshold) {
    this.minThreshold = Math.max(0, Math.min(1, threshold));
    this.saveVoicePrints();
    console.log(`[VoicePrint] Min threshold set to ${(this.minThreshold * 100).toFixed(1)}%`);
  }

  // GMM使用フラグを切り替え
  setUseGMM(enabled) {
    this.useGMM = enabled;
    if (enabled && this.voicePrints.length >= 3) {
      this.trainGMM();
    }
    console.log(`[VoicePrint] GMM mode: ${enabled ? 'enabled' : 'disabled'}`);
  }

  // localStorageに保存
  saveVoicePrints() {
    try {
      localStorage.setItem('voicePrints', JSON.stringify(this.voicePrints));
      localStorage.setItem('voicePrintThreshold', this.threshold.toString());
      localStorage.setItem('voicePrintMinThreshold', this.minThreshold.toString());
      localStorage.setItem('voicePrintUseGMM', this.useGMM.toString());
      localStorage.setItem('voicePrintGMMModels', JSON.stringify(this.gmmModels));
    } catch (error) {
      console.error('[VoicePrint] Failed to save voice prints:', error);
    }
  }

  // localStorageから読み込み
  loadVoicePrints() {
    try {
      const saved = localStorage.getItem('voicePrints');
      if (saved) {
        this.voicePrints = JSON.parse(saved);
        console.log(`[VoicePrint] Loaded ${this.voicePrints.length} voice prints`);
      }

      const threshold = localStorage.getItem('voicePrintThreshold');
      if (threshold) {
        const savedThreshold = parseFloat(threshold);
        // 92%未満の古い閾値は92%に更新
        if (savedThreshold >= 0.90) {
          this.threshold = savedThreshold;
        } else {
          console.log(`[VoicePrint] Updating old threshold ${(savedThreshold * 100).toFixed(1)}% to 92%`);
          this.threshold = 0.92;
          this.saveVoicePrints();
        }
      }

      const minThreshold = localStorage.getItem('voicePrintMinThreshold');
      if (minThreshold) {
        this.minThreshold = parseFloat(minThreshold);
      }

      const useGMM = localStorage.getItem('voicePrintUseGMM');
      if (useGMM) {
        this.useGMM = useGMM === 'true';
      }

      const gmmModels = localStorage.getItem('voicePrintGMMModels');
      if (gmmModels) {
        this.gmmModels = JSON.parse(gmmModels);
      }

      console.log(`[VoicePrint] Settings - Threshold: ${(this.threshold * 100).toFixed(1)}%, MinThreshold: ${(this.minThreshold * 100).toFixed(1)}%, GMM: ${this.useGMM}`);
    } catch (error) {
      console.error('[VoicePrint] Failed to load voice prints:', error);
      this.voicePrints = [];
    }
  }
}

export default new VoicePrintService();
