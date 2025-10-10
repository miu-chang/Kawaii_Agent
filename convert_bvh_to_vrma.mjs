/**
 * BVH → VRMA 一括変換スクリプト
 *
 * 使い方：
 * node convert_bvh_to_vrma.mjs
 */

import * as THREE from 'three';
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Blob as NodeBlob } from 'buffer';
import { VRMAnimationExporterPlugin } from './scripts/VRMAnimationExporterPlugin.mjs';

if (typeof globalThis.Blob === 'undefined') {
  globalThis.Blob = NodeBlob;
}

if (typeof globalThis.FileReader === 'undefined') {
  class NodeFileReader {
    constructor() {
      this.result = null;
      this.onload = null;
      this.onloadend = null;
      this.onerror = null;
    }

    readAsArrayBuffer(blob) {
      blob.arrayBuffer()
        .then((buffer) => {
          this.result = buffer;
          if (typeof this.onload === 'function') {
            this.onload({ target: this });
          }
          if (typeof this.onloadend === 'function') {
            this.onloadend({ target: this });
          }
        })
        .catch((error) => {
          if (typeof this.onerror === 'function') {
            this.onerror(error);
          } else {
            console.error('FileReader error:', error);
          }
        });
    }
  }

  globalThis.FileReader = NodeFileReader;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// BVH変換ロジック（bvh2vrmaから移植）
const _v3A = new THREE.Vector3();

function createSkeletonBoundingBox(skeleton) {
  const boundingBox = new THREE.Box3();
  for (const bone of skeleton.bones) {
    boundingBox.expandByPoint(bone.getWorldPosition(_v3A));
  }
  return boundingBox;
}

function getRootBone(skeleton) {
  let rootBone = skeleton.bones[0];
  while (rootBone.parent && rootBone.parent.type === 'Bone') {
    rootBone = rootBone.parent;
  }
  return rootBone;
}

// VRMボーンマッピング（Mixamo命名に対応）
function mapSkeletonToVRM(rootBone) {
  const vrmBoneMap = new Map();

  const setBone = (vrmName, bone) => {
    if (bone && !vrmBoneMap.has(vrmName)) {
      vrmBoneMap.set(vrmName, bone);
    }
  };

  rootBone.traverse((bone) => {
    if (!bone.isBone) return;

    const name = bone.name.toLowerCase();

    // 体幹
    if (name === 'hips') setBone('hips', bone);
    if (name === 'spine') setBone('spine', bone);
    if (name === 'spine1') setBone('chest', bone);
    if (name === 'spine2' || name === 'spine3') setBone('upperChest', bone);
    if (name === 'neck') setBone('neck', bone);
    if (name === 'head') setBone('head', bone);

    // 左腕
    if (name === 'leftshoulder') setBone('leftShoulder', bone);
    if (name === 'leftarm') setBone('leftUpperArm', bone);
    if (name === 'leftforearm') setBone('leftLowerArm', bone);
    if (name === 'lefthand') setBone('leftHand', bone);

    if (name === 'lefthandthumb1') setBone('leftThumbMetacarpal', bone);
    if (name === 'lefthandthumb2') setBone('leftThumbProximal', bone);
    if (name === 'lefthandthumb3') setBone('leftThumbDistal', bone);
    if (name === 'lefthandthumb4') setBone('leftThumbTip', bone);

    if (name === 'lefthandindex1') setBone('leftIndexProximal', bone);
    if (name === 'lefthandindex2') setBone('leftIndexIntermediate', bone);
    if (name === 'lefthandindex3') setBone('leftIndexDistal', bone);
    if (name === 'lefthandindex4') setBone('leftIndexTip', bone);

    if (name === 'lefthandmiddle1') setBone('leftMiddleProximal', bone);
    if (name === 'lefthandmiddle2') setBone('leftMiddleIntermediate', bone);
    if (name === 'lefthandmiddle3') setBone('leftMiddleDistal', bone);
    if (name === 'lefthandmiddle4') setBone('leftMiddleTip', bone);

    if (name === 'lefthandring1') setBone('leftRingProximal', bone);
    if (name === 'lefthandring2') setBone('leftRingIntermediate', bone);
    if (name === 'lefthandring3') setBone('leftRingDistal', bone);
    if (name === 'lefthandring4') setBone('leftRingTip', bone);

    if (name === 'lefthandpinky1') setBone('leftLittleProximal', bone);
    if (name === 'lefthandpinky2') setBone('leftLittleIntermediate', bone);
    if (name === 'lefthandpinky3') setBone('leftLittleDistal', bone);
    if (name === 'lefthandpinky4') setBone('leftLittleTip', bone);

    // 右腕
    if (name === 'rightshoulder') setBone('rightShoulder', bone);
    if (name === 'rightarm') setBone('rightUpperArm', bone);
    if (name === 'rightforearm') setBone('rightLowerArm', bone);
    if (name === 'righthand') setBone('rightHand', bone);

    if (name === 'righthandthumb1') setBone('rightThumbMetacarpal', bone);
    if (name === 'righthandthumb2') setBone('rightThumbProximal', bone);
    if (name === 'righthandthumb3') setBone('rightThumbDistal', bone);
    if (name === 'righthandthumb4') setBone('rightThumbTip', bone);

    if (name === 'righthandindex1') setBone('rightIndexProximal', bone);
    if (name === 'righthandindex2') setBone('rightIndexIntermediate', bone);
    if (name === 'righthandindex3') setBone('rightIndexDistal', bone);
    if (name === 'righthandindex4') setBone('rightIndexTip', bone);

    if (name === 'righthandmiddle1') setBone('rightMiddleProximal', bone);
    if (name === 'righthandmiddle2') setBone('rightMiddleIntermediate', bone);
    if (name === 'righthandmiddle3') setBone('rightMiddleDistal', bone);
    if (name === 'righthandmiddle4') setBone('rightMiddleTip', bone);

    if (name === 'righthandring1') setBone('rightRingProximal', bone);
    if (name === 'righthandring2') setBone('rightRingIntermediate', bone);
    if (name === 'righthandring3') setBone('rightRingDistal', bone);
    if (name === 'righthandring4') setBone('rightRingTip', bone);

    if (name === 'righthandpinky1') setBone('rightLittleProximal', bone);
    if (name === 'righthandpinky2') setBone('rightLittleIntermediate', bone);
    if (name === 'righthandpinky3') setBone('rightLittleDistal', bone);
    if (name === 'righthandpinky4') setBone('rightLittleTip', bone);

    // 左脚
    if (name === 'leftupleg') setBone('leftUpperLeg', bone);
    if (name === 'leftleg') setBone('leftLowerLeg', bone);
    if (name === 'leftfoot') setBone('leftFoot', bone);
    if (name === 'lefttoebase') setBone('leftToes', bone);

    // 右脚
    if (name === 'rightupleg') setBone('rightUpperLeg', bone);
    if (name === 'rightleg') setBone('rightLowerLeg', bone);
    if (name === 'rightfoot') setBone('rightFoot', bone);
    if (name === 'righttoebase') setBone('rightToes', bone);
  });

  return vrmBoneMap;
}

async function convertBVHToVRMAnimation(bvh, options = {}) {
  const scale = options.scale ?? 0.01;

  const skeleton = bvh.skeleton.clone();
  const clip = bvh.clip.clone();

  // find root bone
  const rootBone = getRootBone(skeleton);

  // scale
  rootBone.traverse((bone) => {
    if (bone.isBone) {
      bone.name = bone.name.replace(/^mixamorig:/i, '');
    }
    bone.position.multiplyScalar(scale);
  });
  rootBone.updateWorldMatrix(false, true);

  // create VRM bone map
  const vrmBoneMap = mapSkeletonToVRM(rootBone);
  rootBone.userData.vrmBoneMap = vrmBoneMap;

  const hipsBone = vrmBoneMap.get('hips');
  const hipsBoneName = hipsBone?.name;
  let hipsPositionTrack = null;

  const spineBone = vrmBoneMap.get('spine');
  const spineBoneName = spineBone?.name;

  // filter tracks
  const filteredTracks = [];

  for (const origTrack of bvh.clip.tracks) {
    const track = origTrack.clone();
    track.name = track.name
      .replace(/\.bones\[(.*)\]/, '$1')
      .replace(/mixamorig:/gi, '');

    if (track.name.endsWith('.quaternion')) {
      filteredTracks.push(track);
    }

    if (hipsBoneName && track.name === `${hipsBoneName}.position`) {
      const newTrack = track.clone();
      newTrack.values = track.values.map((v) => v * scale);
      hipsPositionTrack = newTrack;
      filteredTracks.push(newTrack);
    }
  }

  clip.tracks = filteredTracks;
  clip.resetDuration();

  // Remove hips position offset
  if (hipsPositionTrack != null && hipsBone) {
    const offset = hipsBone.position.toArray();
    for (let i = 0; i < hipsPositionTrack.values.length; i++) {
      hipsPositionTrack.values[i] -= offset[i % 3];
    }
  }

  // ground correction
  const boundingBox = createSkeletonBoundingBox(skeleton);
  if (boundingBox.min.y < 0) {
    rootBone.position.y -= boundingBox.min.y;
  }

  // export as glTF
  const exporter = new GLTFExporter();
  exporter.register((writer) => new VRMAnimationExporterPlugin(writer));

  const gltf = await exporter.parseAsync(rootBone, {
    animations: [clip],
    binary: true,
  });

  return gltf;
}

// メイン処理
async function main() {
  const bvhDir = path.join(__dirname, 'bvh');
  const outputDir = path.join(__dirname, 'public', 'animations');

  // 出力ディレクトリ確認
  await fs.mkdir(outputDir, { recursive: true });

  // BVHファイル一覧取得
  const files = await fs.readdir(bvhDir);
  const bvhFiles = files.filter(f => f.endsWith('.bvh'));

  console.log(`Found ${bvhFiles.length} BVH files\n`);

  const loader = new BVHLoader();

  // 各BVHファイルを変換
  for (const filename of bvhFiles) {
    const bvhPath = path.join(bvhDir, filename);
    const baseName = path.basename(filename, '.bvh');

    // ファイル名変換（推奨命名）
    let outputName = baseName.toLowerCase().replace(/ /g, '_');
    if (outputName.includes('dwarf_idle-2')) outputName = 'idle_02';
    else if (outputName.includes('dwarf_idle')) outputName = 'idle_01';
    else if (outputName.includes('look_around')) outputName = 'look_around';
    else if (outputName.includes('waving-2')) outputName = 'wave_02';
    else if (outputName.includes('waving')) outputName = 'wave';
    else if (outputName.includes('excited')) outputName = 'excited';
    else if (outputName.includes('thinking')) outputName = 'thinking';
    else if (outputName.includes('joyful_jump')) outputName = 'joy';
    else if (outputName.includes('standing_clap-2')) outputName = 'clap_02';
    else if (outputName.includes('standing_clap')) outputName = 'clap';
    else if (outputName.includes('happy_walk')) outputName = 'happy_walk';
    else if (outputName.includes('walking')) outputName = 'walk';
    else if (outputName.includes('turning')) outputName = 'turn';
    else if (outputName.includes('drunk_walking_turn')) outputName = 'drunk_walk';
    else if (outputName.includes('typing')) outputName = 'typing';
    else if (outputName.includes('singing')) outputName = 'singing';

    const outputPath = path.join(outputDir, `${outputName}.vrma`);

    try {
      console.log(`Converting: ${filename} → ${outputName}.vrma`);

      // BVH読み込み
      const bvhData = await fs.readFile(bvhPath, 'utf-8');
      const bvh = loader.parse(bvhData);

      // VRMA変換
      const vrmaBuffer = await convertBVHToVRMAnimation(bvh, { scale: 0.01 });

      // ファイル保存
      await fs.writeFile(outputPath, Buffer.from(vrmaBuffer));

      console.log(`✓ Saved: ${outputPath}\n`);
    } catch (error) {
      console.error(`✗ Error converting ${filename}:`, error.message);
      console.error(error);
    }
  }

  console.log('All conversions complete!');
  console.log(`Output directory: ${outputDir}`);
}

main().catch(console.error);
