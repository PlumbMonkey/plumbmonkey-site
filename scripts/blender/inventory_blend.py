"""Print a compact, read-only JSON inventory for the currently open Blender file."""

import json
import os

import bpy


def sample_names(items, limit=24):
    return [item.name for item in list(items)[:limit]]


def main():
    objects_by_type = {}
    for obj in bpy.data.objects:
        objects_by_type[obj.type] = objects_by_type.get(obj.type, 0) + 1

    missing_images = []
    packed_images = 0
    for image in bpy.data.images:
        if image.packed_file:
            packed_images += 1
            continue
        if not image.filepath or image.source not in {"FILE", "SEQUENCE", "MOVIE"}:
            continue
        resolved = bpy.path.abspath(image.filepath)
        if not os.path.exists(resolved):
            missing_images.append(image.name)

    armatures = []
    for armature in bpy.data.armatures:
        armatures.append({"name": armature.name, "bones": len(armature.bones)})

    mesh_vertices = sum(len(mesh.vertices) for mesh in bpy.data.meshes)
    mesh_polygons = sum(len(mesh.polygons) for mesh in bpy.data.meshes)
    geometry_nodes = sum(
        1
        for obj in bpy.data.objects
        for modifier in obj.modifiers
        if modifier.type == "NODES"
    )
    asset_count = sum(
        1
        for group in (
            bpy.data.objects,
            bpy.data.collections,
            bpy.data.materials,
            bpy.data.node_groups,
            bpy.data.worlds,
        )
        for item in group
        if getattr(item, "asset_data", None)
    )

    inventory = {
        "file": bpy.data.filepath,
        "blender_version": bpy.app.version_string,
        "scenes": [
            {
                "name": scene.name,
                "frame_start": scene.frame_start,
                "frame_end": scene.frame_end,
                "render_engine": scene.render.engine,
                "resolution": [scene.render.resolution_x, scene.render.resolution_y],
            }
            for scene in bpy.data.scenes
        ],
        "objects": {"total": len(bpy.data.objects), "by_type": objects_by_type},
        "object_samples": {
            object_type: sample_names([obj for obj in bpy.data.objects if obj.type == object_type])
            for object_type in sorted(objects_by_type)
        },
        "collections": {"count": len(bpy.data.collections), "samples": sample_names(bpy.data.collections)},
        "meshes": {"count": len(bpy.data.meshes), "vertices": mesh_vertices, "polygons": mesh_polygons},
        "materials": {"count": len(bpy.data.materials), "samples": sample_names(bpy.data.materials)},
        "images": {
            "count": len(bpy.data.images),
            "packed": packed_images,
            "missing_count": len(missing_images),
            "missing_samples": missing_images[:24],
        },
        "armatures": armatures,
        "actions": {"count": len(bpy.data.actions), "samples": sample_names(bpy.data.actions)},
        "node_groups": {"count": len(bpy.data.node_groups), "geometry_node_modifiers": geometry_nodes},
        "linked_libraries": {"count": len(bpy.data.libraries), "samples": sample_names(bpy.data.libraries)},
        "marked_assets": asset_count,
    }
    print("ARTROOM_INVENTORY_JSON=" + json.dumps(inventory, separators=(",", ":")))


if __name__ == "__main__":
    main()
