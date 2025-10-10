import argparse
import os
import sys
import bpy

def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []
    parser = argparse.ArgumentParser(description="Convert FBX animations to BVH using Blender")
    parser.add_argument("--input-dir", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--global-scale", type=float, default=1.0)
    return parser.parse_known_args(argv)[0]


def cleanup_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def convert_file(fbx_path, output_path, global_scale):
    cleanup_scene()
    bpy.ops.import_scene.fbx(filepath=fbx_path, automatic_bone_orientation=True)

    armatures = [obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE']
    if not armatures:
        print(f"[WARN] No armature found in {fbx_path}")
        return False

    bpy.ops.object.select_all(action='DESELECT')
    for obj in armatures:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = armatures[0]

    frame_start = bpy.context.scene.frame_start
    frame_end = bpy.context.scene.frame_end

    bpy.ops.export_anim.bvh(
        filepath=output_path,
        frame_start=frame_start,
        frame_end=frame_end,
        rotate_mode='NATIVE',
        global_scale=global_scale,
        root_transform_only=False,
    )
    print(f"[INFO] Exported {output_path}")
    return True


def main():
    args = parse_args()
    input_dir = os.path.abspath(args.input_dir)
    output_dir = os.path.abspath(args.output_dir)
    os.makedirs(output_dir, exist_ok=True)

    success = 0
    total = 0

    for entry in sorted(os.listdir(input_dir)):
        if not entry.lower().endswith('.fbx'):
            continue
        total += 1
        fbx_path = os.path.join(input_dir, entry)
        base_name = os.path.splitext(entry)[0]
        output_path = os.path.join(output_dir, f"{base_name}.bvh")
        if convert_file(fbx_path, output_path, args.global_scale):
            success += 1

    print(f"[INFO] Converted {success}/{total} FBX files to BVH")


if __name__ == "__main__":
    main()
