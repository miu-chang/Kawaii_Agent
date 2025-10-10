import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (typeof globalThis.FileReader === 'undefined') {
  class SimpleFileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer()
        .then((buffer) => {
          this.result = buffer;
          this.onloadend?.(new Event('loadend'));
        })
        .catch((error) => {
          this.error = error;
          this.onerror?.(error);
        });
    }

    readAsDataURL(blob) {
      blob.arrayBuffer()
        .then((buffer) => {
          const base64 = Buffer.from(buffer).toString('base64');
          const mime = blob.type || 'application/octet-stream';
          this.result = `data:${mime};base64,${base64}`;
          this.onloadend?.(new Event('loadend'));
        })
        .catch((error) => {
          this.error = error;
          this.onerror?.(error);
        });
    }
  }

  globalThis.FileReader = SimpleFileReader;
}

const EXTENSION_NAME = 'VRMC_vrm_animation';

class VRMAnimationExporterPlugin {
  constructor(writer) {
    this.writer = writer;
    this.name = EXTENSION_NAME;
  }

  afterParse(input) {
    if (!Array.isArray(input)) {
      return;
    }

    const root = input[0];
    const vrmBoneMap = root.userData?.vrmBoneMap;
    if (!vrmBoneMap) {
      return;
    }

    const humanBones = {};
    for (const [boneName, bone] of vrmBoneMap) {
      const node = this.writer.nodeMap?.get ? this.writer.nodeMap.get(bone) : undefined;
      if (node != null) {
        humanBones[boneName] = { node };
      }
    }

    const gltfDef = this.writer.json;
    gltfDef.extensionsUsed ||= [];
    if (!gltfDef.extensionsUsed.includes(this.name)) {
      gltfDef.extensionsUsed.push(this.name);
    }

    gltfDef.extensions ||= {};
    gltfDef.extensions[this.name] = {
      specVersion: '1.0',
      humanoid: { humanBones },
    };
  }
}

function pickByProbability(array, evaluators) {
  if (array.length < 1) {
    return null;
  }

  const results = array.map(() => 0.0);

  for (const evaluator of evaluators) {
    const { func, weight } = evaluator;
    let min = Infinity;
    let max = -Infinity;

    const evaluatorResults = array.map((value) => {
      const evaluatorResult = func(value);
      min = Math.min(min, evaluatorResult);
      max = Math.max(max, evaluatorResult);
      return evaluatorResult;
    });

    const range = max - min;
    if (range > 0.0) {
      evaluatorResults.forEach((v, i) => {
        results[i] += weight * (v - min) / range;
      });
    }
  }

  let highestResult = -Infinity;
  let highestIndex = 0;

  results.forEach((result, i) => {
    if (result > highestResult) {
      highestResult = result;
      highestIndex = i;
    }
  });

  return array[highestIndex];
}

function getRootBone(skeleton) {
  const boneSet = new Set(skeleton.bones);

  for (const bone of skeleton.bones) {
    if (bone.parent == null || !boneSet.has(bone.parent)) {
      return bone;
    }
  }

  throw new Error('Invalid skeleton. Could not find the root bone of the given skeleton.');
}

const _v3A = new THREE.Vector3();

function objectBFS(root, fn) {
  const queue = [root];

  while (queue.length > 0) {
    const obj = queue.shift();
    if (fn(obj)) {
      return obj;
    }
    queue.push(...obj.children);
  }

  return null;
}

function objectTraverseFilter(root, fn) {
  const result = [];

  root.traverse((obj) => {
    if (fn(obj)) {
      result.push(obj);
    }
  });

  return result;
}

function objectSearchAncestors(root, fn) {
  let obj = root;

  while (obj != null) {
    if (fn(obj)) {
      return obj;
    }
    obj = obj.parent;
  }

  return null;
}

function sortObjectArrayByWorldX(objects) {
  const objWorldXMap = new Map();

  for (const obj of objects) {
    objWorldXMap.set(obj, obj.getWorldPosition(_v3A).x);
  }

  return objects.sort((a, b) => objWorldXMap.get(a) - objWorldXMap.get(b));
}

function evaluatorEqual(obj, another) {
  return obj === another ? 1 : 0;
}

function evaluatorName(obj, substring) {
  const nameLowerCase = obj.name.toLowerCase();
  return nameLowerCase.includes(substring) ? 1 : 0;
}

function determineSpineBones(hips, chestCand) {
  const spineBones = [];
  objectSearchAncestors(chestCand, (obj) => {
    spineBones.unshift(obj);
    return obj === hips;
  });

  if (spineBones.length < 3) {
    throw new Error('Not enough spine bones.');
  } else if (spineBones.length === 3) {
    return [spineBones[1], spineBones[2], null];
  } else if (spineBones.length === 4) {
    return [spineBones[1], spineBones[2], spineBones[3]];
  }

  console.warn('The skeleton has more spine bones than VRM requires. You might get an unexpected result.');
  return [
    spineBones[Math.floor((spineBones.length - 1) / 3.0)],
    spineBones[Math.floor(((spineBones.length - 1) / 3.0) * 2.0)],
    spineBones[spineBones.length - 1],
  ];
}

function determineLegBones(legRoot) {
  const bones = [];

  let currentBone = legRoot;
  let currentDepth = 0;

  while (currentBone != null) {
    const firstChild = currentBone.children[0];

    bones.push({
      bone: currentBone,
      depth: currentDepth,
      len: firstChild?.position.length() ?? 0.0,
    });

    currentBone = firstChild;
    currentDepth++;
  }

  if (bones.length < 3) {
    throw new Error('Not enough leg bones.');
  }

  const [upperLeg, lowerLeg] = bones
    .concat()
    .sort((a, b) => b.len - a.len)
    .slice(0, 2)
    .sort((a, b) => a.depth - b.depth);

  const foot = bones[lowerLeg.depth + 1];
  if (!foot) {
    throw new Error('Could not find the foot bone.');
  }

  const toes = bones[foot.depth + 1];

  return [upperLeg.bone, lowerLeg.bone, foot.bone, toes?.bone ?? null];
}

function determineArmBones(armRoot) {
  const bones = [];

  let currentBone = armRoot;
  let currentDepth = 0;

  while (currentBone != null) {
    const firstChild = currentBone.children[0];

    bones.push({
      bone: currentBone,
      depth: currentDepth,
      len: firstChild?.position.length() ?? 0.0,
    });

    currentBone = firstChild;
    currentDepth++;
  }

  if (bones.length < 3) {
    throw new Error('Not enough arm bones.');
  }

  const [upperArm, lowerArm] = bones
    .concat()
    .sort((a, b) => b.len - a.len)
    .slice(0, 2)
    .sort((a, b) => a.depth - b.depth);

  const hand = bones[lowerArm.depth + 1];
  if (hand == null) {
    throw new Error('Could not find the foot bone.');
  }

  const shoulder = upperArm.depth !== 0 ? bones[upperArm.depth - 1] : null;

  return [shoulder?.bone ?? null, upperArm.bone, lowerArm.bone, hand.bone];
}

function determineFingerBones(result) {
  const leftRights = ['left', 'right'];
  const handBoneMap = {
    left: result.get('leftHand'),
    right: result.get('rightHand'),
  };

  const fingerNames = ['thumb', 'index', 'middle', 'ring', 'little'];
  const fingerBoneNamesMap = {
    left: {
      thumb: ['leftThumbMetacarpal', 'leftThumbProximal', 'leftThumbDistal'],
      index: ['leftIndexProximal', 'leftIndexIntermediate', 'leftIndexDistal'],
      middle: ['leftMiddleProximal', 'leftMiddleIntermediate', 'leftMiddleDistal'],
      ring: ['leftRingProximal', 'leftRingIntermediate', 'leftRingDistal'],
      little: ['leftLittleProximal', 'leftLittleIntermediate', 'leftLittleDistal'],
    },
    right: {
      thumb: ['rightThumbMetacarpal', 'rightThumbProximal', 'rightThumbDistal'],
      index: ['rightIndexProximal', 'rightIndexIntermediate', 'rightIndexDistal'],
      middle: ['rightMiddleProximal', 'rightMiddleIntermediate', 'rightMiddleDistal'],
      ring: ['rightRingProximal', 'rightRingIntermediate', 'rightRingDistal'],
      little: ['rightLittleProximal', 'rightLittleIntermediate', 'rightLittleDistal'],
    },
  };

  for (const leftRight of leftRights) {
    const handBone = handBoneMap[leftRight];
    const fingerRoots = handBone.children.concat();

    for (const fingerName of fingerNames) {
      const fingerBoneNames = fingerBoneNamesMap[leftRight][fingerName];

      const fingerRoot = pickByProbability(
        fingerRoots,
        [
          { func: (obj) => evaluatorName(obj, fingerName), weight: 10.0 },
          { func: (obj) => obj.getWorldPosition(_v3A).z, weight: 1.0 },
        ],
      );

      if (fingerRoot != null) {
        fingerRoots.splice(fingerRoots.indexOf(fingerRoot), 1);

        result.set(fingerBoneNames[0], fingerRoot);

        const child1 = fingerRoot.children[0];
        if (child1 != null) {
          result.set(fingerBoneNames[1], child1);

          const child2 = child1.children[0];
          if (child2 != null) {
            result.set(fingerBoneNames[2], child2);
          }
        }
      }
    }
  }
}

function determineHeadBones(headRoot) {
  let head = headRoot;

  while (head.children.length === 1) {
    head = head.children[0];
  }

  const neck = headRoot === head ? null : headRoot;

  let leftEye = null;
  let rightEye = null;

  if (head.children.length === 0) {
    leftEye = pickByProbability(
      head.children,
      [
        { func: (obj) => evaluatorName(obj, 'lefteye'), weight: 10.0 },
        { func: (obj) => evaluatorName(obj, 'l_faceeye'), weight: 10.0 },
        { func: (obj) => evaluatorName(obj, 'eye'), weight: 1.0 },
        { func: (obj) => obj.getWorldPosition(_v3A).x, weight: 1.0 },
      ],
    );

    rightEye = pickByProbability(
      head.children,
      [
        { func: (obj) => evaluatorEqual(obj, leftEye), weight: -100.0 },
        { func: (obj) => evaluatorName(obj, 'righteye'), weight: 10.0 },
        { func: (obj) => evaluatorName(obj, 'r_faceeye'), weight: 10.0 },
        { func: (obj) => evaluatorName(obj, 'eye'), weight: 1.0 },
        { func: (obj) => -obj.getWorldPosition(_v3A).x, weight: 1.0 },
      ],
    );
  }

  return [neck, head, leftEye ?? null, rightEye ?? null];
}

function mapSkeletonToVRM(root) {
  const result = new Map();

  const hips = objectBFS(root, (obj) => {
    return obj.children.length >= 3;
  });
  if (hips == null) {
    throw new Error('Cannot find hips.');
  }
  result.set('hips', hips);

  const chestCands = objectTraverseFilter(hips, (obj) => {
    return obj !== hips && obj.children.length >= 3;
  });
  const chestCand = pickByProbability(
    chestCands,
    [
      { func: (obj) => evaluatorName(obj, 'upperchest'), weight: 1.0 },
      { func: (obj) => evaluatorName(obj, 'chest'), weight: 1.0 },
    ],
  );
  if (chestCand == null) {
    throw new Error('Cannot find chest.');
  }

  const [spine, chest, upperChest] = determineSpineBones(hips, chestCand);
  result.set('spine', spine);
  result.set('chest', chest);
  if (upperChest != null) {
    result.set('upperChest', upperChest);
  }

  const leftLegRoot = pickByProbability(
    hips.children,
    [
      { func: (obj) => evaluatorName(obj, 'leftupperleg'), weight: 10.0 },
      { func: (obj) => evaluatorName(obj, 'l_upperleg'), weight: 10.0 },
      { func: (obj) => evaluatorName(obj, 'leg'), weight: 1.0 },
      { func: (obj) => obj.getWorldPosition(_v3A).x, weight: 1.0 },
    ],
  );
  const rightLegRoot = pickByProbability(
    hips.children,
    [
      { func: (obj) => evaluatorEqual(obj, leftLegRoot), weight: -100.0 },
      { func: (obj) => evaluatorName(obj, 'rightupperleg'), weight: 10.0 },
      { func: (obj) => evaluatorName(obj, 'r_upperleg'), weight: 10.0 },
      { func: (obj) => evaluatorName(obj, 'leg'), weight: 1.0 },
      { func: (obj) => -obj.getWorldPosition(_v3A).x, weight: 1.0 },
    ],
  );

  const [leftUpperLeg, leftLowerLeg, leftFoot, leftToes] = determineLegBones(leftLegRoot);
  result.set('leftUpperLeg', leftUpperLeg);
  result.set('leftLowerLeg', leftLowerLeg);
  result.set('leftFoot', leftFoot);
  if (leftToes != null) {
    result.set('leftToes', leftToes);
  }

  const [rightUpperLeg, rightLowerLeg, rightFoot, rightToes] = determineLegBones(rightLegRoot);
  result.set('rightUpperLeg', rightUpperLeg);
  result.set('rightLowerLeg', rightLowerLeg);
  result.set('rightFoot', rightFoot);
  if (rightToes != null) {
    result.set('rightToes', rightToes);
  }

  const leftArmRoot = pickByProbability(
    chestCand.children,
    [
      { func: (obj) => evaluatorName(obj, 'leftshoulder'), weight: 10.0 },
      { func: (obj) => evaluatorName(obj, 'l_shoulder'), weight: 10.0 },
      { func: (obj) => evaluatorName(obj, 'leftupperarm'), weight: 10.0 },
      { func: (obj) => evaluatorName(obj, 'l_upperarm'), weight: 10.0 },
      { func: (obj) => evaluatorName(obj, 'shoulder'), weight: 1.0 },
      { func: (obj) => evaluatorName(obj, 'arm'), weight: 1.0 },
      { func: (obj) => obj.getWorldPosition(_v3A).x, weight: 1.0 },
    ],
  );
  const rightArmRoot = pickByProbability(
    chestCand.children,
    [
      { func: (obj) => evaluatorEqual(obj, leftArmRoot), weight: -100.0 },
      { func: (obj) => evaluatorName(obj, 'rightshoulder'), weight: 10.0 },
      { func: (obj) => evaluatorName(obj, 'r_shoulder'), weight: 10.0 },
      { func: (obj) => evaluatorName(obj, 'rightupperarm'), weight: 10.0 },
      { func: (obj) => evaluatorName(obj, 'r_upperarm'), weight: 10.0 },
      { func: (obj) => evaluatorName(obj, 'shoulder'), weight: 1.0 },
      { func: (obj) => evaluatorName(obj, 'arm'), weight: 1.0 },
      { func: (obj) => -obj.getWorldPosition(_v3A).x, weight: 1.0 },
    ],
  );
  const headRoot = pickByProbability(
    chestCand.children,
    [
      { func: (obj) => evaluatorEqual(obj, leftArmRoot), weight: -100.0 },
      { func: (obj) => evaluatorEqual(obj, rightArmRoot), weight: -100.0 },
      { func: (obj) => evaluatorName(obj, 'neck'), weight: 1.0 },
      { func: (obj) => evaluatorName(obj, 'head'), weight: 1.0 },
      { func: (obj) => Math.abs(obj.getWorldPosition(_v3A).x), weight: -1.0 },
    ],
  );

  const [leftShoulder, leftUpperArm, leftLowerArm, leftHand] = determineArmBones(leftArmRoot);
  if (leftShoulder != null) {
    result.set('leftShoulder', leftShoulder);
  }
  result.set('leftUpperArm', leftUpperArm);
  result.set('leftLowerArm', leftLowerArm);
  result.set('leftHand', leftHand);

  const [rightShoulder, rightUpperArm, rightLowerArm, rightHand] = determineArmBones(rightArmRoot);
  if (rightShoulder != null) {
    result.set('rightShoulder', rightShoulder);
  }
  result.set('rightUpperArm', rightUpperArm);
  result.set('rightLowerArm', rightLowerArm);
  result.set('rightHand', rightHand);

  determineFingerBones(result);

  const [neck, head, leftEye, rightEye] = determineHeadBones(headRoot);
  if (neck != null) {
    result.set('neck', neck);
  }
  result.set('head', head);
  if (leftEye != null) {
    result.set('leftEye', leftEye);
  }
  if (rightEye != null) {
    result.set('rightEye', rightEye);
  }

  return result;
}

function createSkeletonBoundingBox(skeleton) {
  const boundingBox = new THREE.Box3();
  for (const bone of skeleton.bones) {
    boundingBox.expandByPoint(bone.getWorldPosition(_v3A));
  }
  return boundingBox;
}

async function convertBVHToVRMAnimation(bvh, options = {}) {
  const scale = options.scale ?? 0.01;

  const skeleton = bvh.skeleton.clone();

  // Normalize bone names so GLTFExporter bindings resolve (remove prefixes like "mixamorig:")
  skeleton.bones.forEach((bone) => {
    if (typeof bone.name === 'string' && bone.name.includes(':')) {
      bone.name = bone.name.split(':').pop();
    }
  });
  const clip = bvh.clip.clone();

  const rootBone = getRootBone(skeleton);

  rootBone.traverse((bone) => {
    bone.position.multiplyScalar(scale);
  });
  rootBone.updateWorldMatrix(false, true);

  const vrmBoneMap = mapSkeletonToVRM(rootBone);
  rootBone.userData.vrmBoneMap = vrmBoneMap;

  const hipsBone = vrmBoneMap.get('hips');
  const hipsBoneName = hipsBone.name;
  let hipsPositionTrack = null;

  const spineBone = vrmBoneMap.get('spine');
  const spineBoneName = spineBone.name;
  let spinePositionTrack = null;

  const filteredTracks = [];

  for (const origTrack of bvh.clip.tracks) {
    const track = origTrack.clone();
    track.name = track.name.replace(/\.bones\[(.*)\]/, '$1');
    track.name = track.name.replace(/^[^:]+:/, '');

    if (track.name.endsWith('.quaternion')) {
      filteredTracks.push(track);
    }

    if (track.name === `${hipsBoneName}.position`) {
      const newTrack = track.clone();
      newTrack.values = track.values.map((v) => v * scale);
      hipsPositionTrack = newTrack;
      filteredTracks.push(newTrack);
    }

    if (track.name === `${spineBoneName}.position`) {
      const newTrack = track.clone();
      newTrack.values = track.values.map((v) => v * scale);
      spinePositionTrack = newTrack;
    }
  }

  clip.tracks = filteredTracks;

  if (hipsPositionTrack) {
    const offset = hipsBone.position.toArray();
    for (let i = 0; i < hipsPositionTrack.values.length; i++) {
      hipsPositionTrack.values[i] -= offset[i % 3];
    }
  }

  const boundingBox = createSkeletonBoundingBox(skeleton);
  if (boundingBox.min.y < 0) {
    rootBone.position.y -= boundingBox.min.y;
  }

  const exporter = new GLTFExporter();
  exporter.register((writer) => new VRMAnimationExporterPlugin(writer));

  const gltf = await exporter.parseAsync(rootBone, {
    animations: [clip],
    binary: true,
  });

  return gltf;
}

async function main() {
  const bvhDir = path.resolve(__dirname, '..', 'bvh');
  const outDir = path.resolve(__dirname, '..', 'public', 'animations');

  const loader = new BVHLoader();

  const nameMap = new Map([
    ['standing_clap', 'clap'],
    ['standing_clap-2', 'clap_02'],
    ['drunk_walking_turn', 'drunk_walk'],
    ['excited', 'excited'],
    ['happy_walk', 'happy_walk'],
    ['dwarf_idle', 'idle_01'],
    ['dwarf_idle-2', 'idle_02'],
    ['joyful_jump', 'joy'],
    ['look_around', 'look_around'],
    ['singing', 'singing'],
    ['thinking', 'thinking'],
    ['turning', 'turn'],
    ['typing', 'typing'],
    ['walking', 'walk'],
    ['waving', 'wave'],
    ['waving-2', 'wave_02'],
  ]);

  for (const entry of fs.readdirSync(bvhDir)) {
    if (!entry.toLowerCase().endsWith('.bvh')) {
      continue;
    }

    const rawBase = entry.replace(/\.bvh$/i, '').replace(/\s+/g, '_').toLowerCase();
    const mappedBase = nameMap.get(rawBase) ?? rawBase;
    const outPath = path.join(outDir, `${mappedBase}.vrma`);

    console.log(`Converting ${entry} -> ${path.relative(process.cwd(), outPath)}`);
    const filePath = path.join(bvhDir, entry);
    const text = fs.readFileSync(filePath, 'utf8');
    const bvhContent = loader.parse(text);
    const arrayBuffer = await convertBVHToVRMAnimation(bvhContent);
    fs.writeFileSync(outPath, Buffer.from(arrayBuffer));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
