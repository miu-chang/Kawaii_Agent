const EXTENSION_NAME = 'VRMC_vrm_animation';

export class VRMAnimationExporterPlugin {
  constructor(writer) {
    this.writer = writer;
    this.name = EXTENSION_NAME;
  }

  afterParse(input) {
    if (!Array.isArray(input) || input.length === 0) {
      return;
    }

    const root = input[0];
    const vrmBoneMap = root?.userData?.vrmBoneMap;
    if (!vrmBoneMap) {
      return;
    }

    const humanBones = {};
    for (const [boneName, bone] of vrmBoneMap.entries()) {
      const node = this.writer?.nodeMap?.get(bone);
      if (node !== undefined) {
        humanBones[boneName] = { node };
      }
    }

    if (!Object.keys(humanBones).length) {
      return;
    }

    const gltfDef = this.writer?.json;
    if (!gltfDef) {
      return;
    }

    gltfDef.extensionsUsed ??= [];
    if (!gltfDef.extensionsUsed.includes(EXTENSION_NAME)) {
      gltfDef.extensionsUsed.push(EXTENSION_NAME);
    }

    gltfDef.extensions ??= {};
    gltfDef.extensions[EXTENSION_NAME] = {
      specVersion: '1.0',
      humanoid: {
        humanBones
      }
    };
  }
}
