import { AnimationFrame, NaturalMediaDocument } from "./documentModel";

export const boneWorld = (document: NaturalMediaDocument, frame: AnimationFrame, boneId: string): { x: number; y: number; rotation: number } => {
  const bone = document.rig.bones.find((item) => item.id === boneId);
  if (!bone) return { x: 0, y: 0, rotation: 0 };
  const localRotation = bone.restRotation + (frame.bonePose[bone.id] ?? 0);
  if (!bone.parentId) return { x: bone.x, y: bone.y, rotation: localRotation };
  const parent = document.rig.bones.find((item) => item.id === bone.parentId);
  const world = boneWorld(document, frame, bone.parentId);
  return { x: world.x + Math.cos(world.rotation * Math.PI / 180) * (parent?.length ?? 0), y: world.y + Math.sin(world.rotation * Math.PI / 180) * (parent?.length ?? 0), rotation: world.rotation + localRotation };
};

export const poseRotation = (document: NaturalMediaDocument, frame: AnimationFrame, boneId: string): number => {
  const bone = document.rig.bones.find((item) => item.id === boneId);
  return (frame.bonePose[boneId] ?? 0) + (bone?.parentId ? poseRotation(document, frame, bone.parentId) : 0);
};
