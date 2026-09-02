/* ============================================================
   Plumbmonkey — keep the camera inside the room.

   Every 3D room is a shell with nothing modelled on the outside of it, and
   OrbitControls' only positional limit is `maxDistance` — a radius from a
   target that the viewpoint buttons themselves move. So the camera could be
   orbited straight out through a wall, and the room read as what it actually
   is: a box, lit from the inside, floating in the void. The Spectral Grand
   Theatre was the worst of them, with maxDistance 90 in a house 45 m deep.

   This clamps the camera (and the orbit target it swings around) into the
   room's own bounding volume every frame, just after controls.update().

   HOW THE VOLUME IS CHOSEN

   From the model, not from hand-typed numbers: the room's Box3 inset by a
   margin. Re-export a room larger or smaller and the cage follows it.

   The volume is then EXPANDED to include every camera baked into the glTF.
   Those are the viewpoint buttons, and some of them sit very close to a wall
   on purpose — the music room's hero camera has 0.6 m of clearance, barely
   more than the margin. Growing the cage to swallow them means a preset can
   never be clamped away from the shot it was placed for, however tight the
   framing, and it costs at most that camera's own clearance back.

   A round room needs more than a box: the corners of a rotunda's AABB are a
   long way outside its wall. Pass `radius` and the XZ distance from the axis
   is clamped too.
   ============================================================ */
import * as THREE from 'three';

const _v = new THREE.Vector3();

/**
 * @param {object}  o
 * @param {THREE.Camera} o.camera
 * @param {object}  o.controls        OrbitControls (its .target is clamped too)
 * @param {THREE.Object3D} o.object   the loaded room, for its bounds and cameras
 * @param {number} [o.margin=0.5]     how far inside the shell the camera stays
 * @param {number} [o.floorY]         lowest the camera may drop; defaults to
 *                                    box.min.y + 1.0, which is wrong wherever a
 *                                    room has geometry under its floor (the
 *                                    foyer's bounds reach y = -2), so rooms
 *                                    that do should pass this explicitly
 * @param {number} [o.radius]         optional cylindrical clamp about the Y axis
 */
export function createRoomBounds(o) {
  const { camera, controls, object } = o;
  const margin = o.margin ?? 0.5;
  const radius = o.radius ?? null;

  const box = new THREE.Box3().setFromObject(object);
  const cage = box.clone().expandByScalar(-margin);

  // Never let the cage clamp a viewpoint the room ships with.
  object.traverse((n) => {
    if (n.isCamera) cage.expandByPoint(n.getWorldPosition(_v).clone());
  });

  const floorY = o.floorY ?? (box.min.y + 1.0);
  cage.min.y = Math.max(cage.min.y, floorY);
  if (cage.max.y < cage.min.y) cage.max.y = cage.min.y;   // degenerate room

  // A cage inset from a very small room can invert; fall back to the raw box.
  if (cage.min.x > cage.max.x || cage.min.z > cage.max.z) cage.copy(box);

  const targetCage = cage;
  let radiusLimit = radius;

  function clampPoint(p) {
    p.x = Math.min(Math.max(p.x, cage.min.x), cage.max.x);
    p.y = Math.min(Math.max(p.y, cage.min.y), cage.max.y);
    p.z = Math.min(Math.max(p.z, cage.min.z), cage.max.z);
    if (radiusLimit) {
      const d = Math.hypot(p.x, p.z);
      if (d > radiusLimit) {
        const k = radiusLimit / d;
        p.x *= k;
        p.z *= k;
      }
    }
    return p;
  }

  return {
    box,
    cage,

    /** Call once per frame, immediately after controls.update(). */
    apply() {
      // The target first: orbiting around a point outside the room would drag
      // the camera out after it however tightly the camera itself is held.
      clampPoint(controls.target);
      const before = _v.copy(camera.position);
      clampPoint(camera.position);
      // update() already did lookAt from the UNclamped position, so re-aim or
      // a clamped frame points fractionally off-target.
      if (!before.equals(camera.position)) camera.lookAt(controls.target);
    },

    /** Widen the cage to include a point (e.g. a scripted camera move). */
    include(p) {
      cage.expandByPoint(p);
      return this;
    },

    setRadius(r) { radiusLimit = r; return this; },
  };
}
