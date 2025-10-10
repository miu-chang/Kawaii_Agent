// VRMA (VRM Animation) ローダー
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import * as THREE from 'three';

export class VRMALoader {
  constructor() {
    this.loader = new GLTFLoader();
    this.loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
  }

  /**
   * VRMAファイルを読み込んでThree.jsのAnimationClipに変換
   * @param {string} url - VRMAファイルのURL
   * @param {VRM} vrm - 適用対象のVRMモデル
   * @returns {Promise<THREE.AnimationClip>}
   */
  async load(url, vrm) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          console.log('VRMA loaded:', gltf);

          // VRMアニメーションデータを取得
          const vrmAnimations = gltf.userData.vrmAnimations;

          if (!vrmAnimations || vrmAnimations.length === 0) {
            reject(new Error('No VRM animations found in file'));
            return;
          }

          // 最初のアニメーションを使用
          const vrmAnimation = vrmAnimations[0];

          // VRMアニメーションをThree.js AnimationClipに変換
          const clip = createVRMAnimationClip(vrmAnimation, vrm);

          console.log('Animation clip created:', clip);
          resolve(clip);
        },
        (progress) => {
          console.log('Loading VRMA:', (progress.loaded / progress.total) * 100, '%');
        },
        (error) => {
          console.error('Error loading VRMA:', error);
          reject(error);
        }
      );
    });
  }

  /**
   * 複数のVRMAファイルを読み込む
   * @param {string[]} urls - VRMAファイルのURLリスト
   * @param {VRM} vrm - 適用対象のVRMモデル
   * @returns {Promise<THREE.AnimationClip[]>}
   */
  async loadMultiple(urls, vrm) {
    const promises = urls.map(url => this.load(url, vrm));
    return Promise.all(promises);
  }
}

/**
 * VRMAアニメーションマネージャー
 */
export class VRMAAnimationManager {
  constructor(vrm) {
    this.vrm = vrm;
    this.mixer = new THREE.AnimationMixer(vrm.scene);
    this.currentAction = null;
    this.currentAnimationName = null;
    this.clips = new Map(); // name -> AnimationClip
    this.loader = new VRMALoader();
  }

  /**
   * VRMAファイルを読み込んで登録
   * @param {string} name - アニメーション名
   * @param {string} url - VRMAファイルのURL
   */
  async loadAnimation(name, url) {
    try {
      const clip = await this.loader.load(url, this.vrm);
      this.clips.set(name, clip);
      console.log(`Animation "${name}" loaded and registered`);
      return clip;
    } catch (error) {
      console.error(`Failed to load animation "${name}":`, error);
      throw error;
    }
  }

  /**
   * アニメーションを再生
   * @param {string} name - アニメーション名
   * @param {object} options - オプション
   */
  play(name, options = {}) {
    const clip = this.clips.get(name);
    if (!clip) {
      console.warn(`Animation "${name}" not found`);
      return null;
    }

    // 現在のアニメーションを停止
    if (this.currentAction) {
      this.currentAction.fadeOut(options.fadeOutDuration || 0.3);
    }

    // 新しいアニメーションを再生
    const action = this.mixer.clipAction(clip);

    // オプション設定
    action.reset();

    // loop オプションは THREE.js の定数を期待しているため、boolean が渡された場合は適切な定数へ変換
    let loopMode = THREE.LoopRepeat;
    if (options.loop !== undefined) {
      if (options.loop === true) {
        loopMode = THREE.LoopRepeat;
      } else if (options.loop === false) {
        loopMode = THREE.LoopOnce;
      } else {
        loopMode = options.loop;
      }
    }

    action.setLoop(loopMode, options.loopCount ?? Infinity);
    action.clampWhenFinished = options.clampWhenFinished || false;
    action.fadeIn(options.fadeInDuration || 0.3);
    action.play();

    this.currentAction = action;
    this.currentAnimationName = name;

    console.log(`Playing animation "${name}"`);
    return action;
  }

  /**
   * 現在のアニメーションを停止
   * @param {number} fadeOutDuration - フェードアウト時間
   */
  stop(fadeOutDuration = 0.3) {
    if (this.currentAction) {
      this.currentAction.fadeOut(fadeOutDuration);
      this.currentAction = null;
      this.currentAnimationName = null;
    }
  }

  /**
   * アニメーションの更新（毎フレーム呼ぶ）
   * @param {number} delta - 前フレームからの経過時間
   */
  update(delta) {
    if (this.mixer) {
      this.mixer.update(delta);
    }
  }

  /**
   * 登録済みアニメーション一覧を取得
   */
  getAnimationNames() {
    return Array.from(this.clips.keys());
  }

  /**
   * アニメーションが再生中かどうか
   */
  isPlaying() {
    if (!this.currentAction) {
      return false;
    }

    // isRunning が false の間でも、有効なウエイトを持つアクションが存在すれば「再生中」とみなす
    if (typeof this.currentAction.isRunning === 'function' && this.currentAction.isRunning()) {
      return true;
    }

    if (typeof this.currentAction.getEffectiveWeight === 'function') {
      return this.currentAction.enabled && this.currentAction.getEffectiveWeight() > 0;
    }

    return this.currentAction.enabled;
  }

  /**
   * クリーンアップ
   */
  dispose() {
    this.stop(0);
    this.mixer.stopAllAction();
    this.clips.clear();
    this.currentAnimationName = null;
  }

  /**
   * 現在再生中(予定)のアニメーション名
   */
  getCurrentAnimationName() {
    return this.currentAnimationName;
  }

  /**
   * 指定したアニメーションのdurationを取得
   * @param {string} name - アニメーション名
   * @returns {number|null} duration (秒) または null
   */
  getDuration(name) {
    const clip = this.clips.get(name);
    return clip ? clip.duration : null;
  }
}
