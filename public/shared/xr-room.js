/* ============================================================
   Plumbmonkey — WebXR layer for the two 3D rooms (Phase 5).

   One module, imported by both /gallery/viewer.html and /theatre/viewer.html:

     import { initXRRoom } from '/shared/xr-room.js';
     const xr = initXRRoom({ renderer, scene, camera, controls, ... });
     ...
     renderer.setAnimationLoop(() => {
       if (!xr.presenting) controls.update();   // see "Why the viewer must skip
       xr.update();                             //  controls.update()" below
       renderer.render(scene, camera);
     });

   It imports `three` as a bare specifier, which resolves against the *document's*
   import map, not this file's location — so it works from /shared/ on both pages
   even though the map lives in each viewer's HTML.

   WHAT IS DELIBERATELY NOT USED HERE
   ----------------------------------
   · three's own `VRButton.js`. It always renders something: on a machine with no
     headset it shows a "VR NOT SUPPORTED" pill at bottom:20px, centred — exactly
     where both viewers already put their #views bar. Every desktop visitor would
     get a collision for a control they cannot use. The button below is created
     only after isSessionSupported('immersive-vr') resolves true, so desktop sees
     nothing at all.
   · `XRControllerModelFactory.js`. It downloads controller meshes from
     cdn.jsdelivr.net at runtime (its DEFAULT_PROFILES_PATH). The site loads no
     CDN assets anywhere — three itself is vendored for that reason — so the
     controllers get a locally-built grip and ray instead.

   HOW "CONFINED TO THE ROOM" IS ENFORCED
   --------------------------------------
   There is no continuous locomotion and no bounding box. Movement is teleport
   only, and the teleport arc raycasts against a *named whitelist of floor
   meshes* (`walkable`) — nothing else in the scene is a valid landing target.
   You cannot leave the room because there is nowhere outside it to land. That
   also means the constraint follows the geometry for free: the gallery's
   balcony and stair flight are reachable because they are real walkable
   surfaces, with no anchor list to maintain.

   WHY THE VIEWER MUST SKIP controls.update() WHILE PRESENTING
   -----------------------------------------------------------
   In XR, three decomposes the headset pose into `camera.position`/`.quaternion`
   every frame. OrbitControls writes those same properties. Left running, the two
   fight, and — worse — whatever pose the headset last had is still sitting in the
   camera when the session ends. So this module disables `controls` on session
   start, snapshots the desktop camera + target, and restores both on session end.
   The viewer still has to skip the `controls.update()` call itself, since damping
   runs regardless of `.enabled`.
   ============================================================ */

import * as THREE from 'three';

/* Brass tokens, same as /shared/room-menu.css and /shared/site-nav.css. */
const BRASS = 0xe8c97e;
const BRASS_DIM = 0xa97829;
const INK = '#0a0c11';

const TURN_ANGLE = Math.PI / 6;      // 30° snap turn
const STICK_ON = 0.75;               // thumbstick deflection that arms an action
const STICK_OFF = 0.35;              // ...and the lower bound it must fall back
                                     //    under before it can fire again
const ARC_STEPS = 28;
const ARC_SPEED = 7.2;               // m/s launch speed along the controller ray
const ARC_GRAVITY = -9.8;
const MAX_TELEPORT = 22;             // metres; a further hit is drawn invalid
const MIN_FLOOR_DOT = 0.72;          // hit face must be within ~44° of straight up

export function initXRRoom(opts) {
  const {
    renderer, scene, camera, controls,
    walkable,                        // RegExp matched against mesh .name
    spawn = { x: 0, z: 0, yaw: 0 },  // floor position; y is found by raycast
    exit = { href: '/', label: 'Exit' },
    roomLabel = 'This room',
    buttonLabel = 'Enter in VR',
  } = opts;

  if (!renderer || !scene || !camera) {
    throw new Error('initXRRoom: renderer, scene and camera are required');
  }

  const api = {
    presenting: false,
    update,
    setRoot,          // the viewer calls this once the GLB is in the scene
    enabled: false,   // flips true only if the device reports immersive-vr
  };

  /* ---------------------------------------------------------------
     Rig. The camera is parented to a Group; in XR three composes the
     headset pose against the parent's world matrix, so moving the rig
     moves the player. Identity transform means desktop is unaffected.
     --------------------------------------------------------------- */
  const rig = new THREE.Group();
  rig.name = 'PM_XRRig';
  scene.add(rig);
  rig.add(camera);

  let walkableMeshes = [];
  const raycaster = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);

  /* Collected from the loaded GLB so the arc only tests floors, not all
     824 gallery meshes. Called by the viewer after gltf.scene is added. */
  function setRoot(root) {
    walkableMeshes = [];
    root.traverse((o) => {
      if (o.isMesh && walkable.test(o.name)) walkableMeshes.push(o);
    });
    if (!walkableMeshes.length) {
      console.warn('xr-room: no walkable meshes matched', walkable,
        '— teleport will have nowhere to land');
    }
  }

  /* ---------------------------------------------------------------
     Entry button. Created only when the device can actually do it.
     --------------------------------------------------------------- */
  let button = null;

  if (navigator.xr && window.isSecureContext) {
    navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
      if (supported) { api.enabled = true; makeButton(); }
    }).catch(() => { /* no headset, or a policy blocks it — stay silent */ });
  }

  function makeButton() {
    const style = document.createElement('style');
    style.textContent = `
      .pm-xr-btn {
        position: fixed; top: 12px; left: 12px; z-index: 35;
        display: inline-flex; align-items: center; gap: 8px;
        height: 36px; padding: 0 14px;
        border: 1px solid rgba(169,120,41,.55); border-radius: 8px;
        background: rgba(10,12,17,.82);
        backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
        color: #e8c97e;
        font: 600 12px/1 Inter, ui-sans-serif, system-ui, sans-serif;
        letter-spacing: .12em; text-transform: uppercase;
        cursor: pointer; transition: background .15s ease, color .15s ease;
      }
      .pm-xr-btn:hover { background: #c4923a; border-color: #c4923a; color: #0a0c11; }
      @media (prefers-reduced-motion: reduce) { .pm-xr-btn { transition: none; } }
    `;
    document.head.appendChild(style);

    button = document.createElement('button');
    button.type = 'button';
    button.className = 'pm-xr-btn';
    button.textContent = buttonLabel;
    button.addEventListener('click', () => {
      const session = renderer.xr.getSession();
      if (session) { session.end(); return; }
      navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor', 'layers'],
      }).then((s) => renderer.xr.setSession(s))
        .catch((e) => { console.error('xr-room: could not start session', e); });
    });
    document.body.appendChild(button);
  }

  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');

  /* ---------------------------------------------------------------
     Controllers: a ray line plus a small grip, both built locally.
     --------------------------------------------------------------- */
  const rayGeo = new THREE.BufferGeometry().setFromPoints(
    [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);

  const gripGeo = new THREE.CylinderGeometry(0.011, 0.017, 0.09, 10);
  gripGeo.rotateX(-Math.PI / 2);
  const gripMat = new THREE.MeshBasicMaterial({ color: BRASS_DIM });

  const hands = [0, 1].map((i) => {
    const ctrl = renderer.xr.getController(i);
    const line = new THREE.Line(rayGeo,
      new THREE.LineBasicMaterial({ color: BRASS, transparent: true, opacity: 0.6 }));
    line.scale.z = 6;
    ctrl.add(line);
    rig.add(ctrl);

    const grip = renderer.xr.getControllerGrip(i);
    grip.add(new THREE.Mesh(gripGeo, gripMat));
    rig.add(grip);

    const hand = { index: i, ctrl, line, grip, source: null,
                   aiming: false, turnLatch: false, menuLatch: false };
    ctrl.addEventListener('connected', (e) => { hand.source = e.data; });
    ctrl.addEventListener('disconnected', () => { hand.source = null; });
    ctrl.addEventListener('selectstart', () => { onSelectStart(hand); });
    ctrl.addEventListener('selectend', () => { onSelectEnd(hand); });
    return hand;
  });

  /* ---------------------------------------------------------------
     Teleport arc + landing marker.
     --------------------------------------------------------------- */
  const arcPoints = new Array(ARC_STEPS + 1).fill(0).map(() => new THREE.Vector3());
  const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPoints);
  const arcMat = new THREE.LineBasicMaterial({ color: BRASS, transparent: true, opacity: 0.85 });
  const arc = new THREE.Line(arcGeo, arcMat);
  arc.frustumCulled = false;
  arc.visible = false;
  scene.add(arc);

  const marker = new THREE.Group();
  marker.visible = false;
  {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.26, 0.34, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: BRASS, transparent: true, opacity: 0.9,
                                    side: THREE.DoubleSide, depthTest: false }));
    const fill = new THREE.Mesh(
      new THREE.CircleGeometry(0.26, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: BRASS, transparent: true, opacity: 0.18,
                                    side: THREE.DoubleSide, depthTest: false }));
    ring.renderOrder = 10; fill.renderOrder = 10;
    marker.add(ring, fill);
  }
  scene.add(marker);

  const landing = new THREE.Vector3();
  let landingValid = false;

  const _o = new THREE.Vector3();
  const _d = new THREE.Vector3();
  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();
  const _seg = new THREE.Vector3();
  const _n = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _m3 = new THREE.Matrix3();

  /* Walks a parabola out from the controller, raycasting each segment against
     the walkable whitelist. First hit wins; the arc is trimmed to it. */
  function aim(hand) {
    hand.ctrl.getWorldPosition(_o);
    hand.ctrl.getWorldQuaternion(_q);
    _d.set(0, 0, -1).applyQuaternion(_q).multiplyScalar(ARC_SPEED);

    landingValid = false;
    let hitAt = -1;
    _a.copy(_o);

    for (let i = 1; i <= ARC_STEPS; i++) {
      const t = i * 0.055;
      _b.set(
        _o.x + _d.x * t,
        _o.y + _d.y * t + 0.5 * ARC_GRAVITY * t * t,
        _o.z + _d.z * t,
      );
      arcPoints[i].copy(_b);

      if (hitAt < 0) {
        _seg.subVectors(_b, _a);
        const len = _seg.length();
        if (len > 1e-5) {
          raycaster.set(_a, _seg.divideScalar(len));
          raycaster.far = len;
          const hits = raycaster.intersectObjects(walkableMeshes, false);
          if (hits.length) {
            const h = hits[0];
            /* Face must point roughly up — stops the arc "landing" on the
               underside of a balcony deck or the riser of a stair tread. */
            _n.set(0, 1, 0);
            if (h.face) {
              _m3.getNormalMatrix(h.object.matrixWorld);
              _n.copy(h.face.normal).applyMatrix3(_m3).normalize();
            }
            if (_n.y >= MIN_FLOOR_DOT && h.point.distanceTo(_o) <= MAX_TELEPORT) {
              landing.copy(h.point);
              landingValid = true;
            }
            hitAt = i;
            arcPoints[i].copy(h.point);
          }
        }
      }
      _a.copy(arcPoints[i]);
    }
    arcPoints[0].copy(_o);

    /* Collapse the tail onto the hit so the line stops there rather than
       sailing through the floor. */
    if (hitAt >= 0) {
      for (let i = hitAt + 1; i <= ARC_STEPS; i++) arcPoints[i].copy(arcPoints[hitAt]);
    }
    arcGeo.setFromPoints(arcPoints);
    arcGeo.attributes.position.needsUpdate = true;

    arc.visible = true;
    arcMat.color.setHex(landingValid ? BRASS : 0x6b4a1c);
    marker.visible = landingValid;
    if (landingValid) marker.position.copy(landing).add(new THREE.Vector3(0, 0.02, 0));
  }

  function clearAim() {
    arc.visible = false;
    marker.visible = false;
    landingValid = false;
  }

  /* Moves the rig so the *player's feet* land on the marker, not the rig
     origin — after room-scale walking the two are metres apart. */
  function teleport() {
    if (!landingValid) return;
    camera.getWorldPosition(_a);
    rig.position.x += landing.x - _a.x;
    rig.position.z += landing.z - _a.z;
    rig.position.y = landing.y;
  }

  /* Snap turn about the head, not the rig origin — turning about the origin
     after walking a few metres swings the player through an arc, which is
     exactly the vestibular mismatch snap turn exists to avoid. */
  function snapTurn(dir) {
    camera.getWorldPosition(_a);
    const angle = dir * TURN_ANGLE;
    const sin = Math.sin(angle), cos = Math.cos(angle);
    const dx = rig.position.x - _a.x;
    const dz = rig.position.z - _a.z;
    rig.position.x = _a.x + dx * cos - dz * sin;
    rig.position.z = _a.z + dx * sin + dz * cos;
    rig.rotation.y += angle;
  }

  /* ---------------------------------------------------------------
     World-space menu. A DOM overlay does not render inside an immersive
     session, so Phase 3's hamburger has to exist again as geometry. It reads
     window.PM_ROOMS — the same list /shared/rooms.js gives the flat navs — so
     the two cannot drift.
     --------------------------------------------------------------- */
  const menu = new THREE.Group();
  menu.visible = false;
  scene.add(menu);

  const ROW_W = 0.52, ROW_H = 0.072, ROW_GAP = 0.006;
  let menuRows = [];
  let menuBuilt = false;

  function rowTexture(text, state) {
    const dpr = 2, w = 512, h = 72;
    const c = document.createElement('canvas');
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);

    if (state === 'hover') { g.fillStyle = '#c4923a'; g.fillRect(0, 0, w, h); }
    else { g.fillStyle = 'rgba(10,12,17,.94)'; g.fillRect(0, 0, w, h); }

    g.fillStyle = state === 'hover' ? INK
                : state === 'current' ? '#e8c97e' : '#d3dae4';
    g.font = '600 26px Inter, ui-sans-serif, system-ui, sans-serif';
    g.textBaseline = 'middle';
    g.fillText(text, 26, h / 2 + 1);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  function buildMenu() {
    /* Deferred to first open on purpose: /shared/rooms.js is a classic deferred
       script and the viewer's inline module runs *before* it, so PM_ROOMS does
       not exist at import time. By the time anyone opens this, it does. */
    const rooms = window.PM_ROOMS;
    if (!rooms) {
      console.error('xr-room: /shared/rooms.js must load before the menu is opened');
      return false;
    }

    const items = rooms.map((r) => ({ href: r.href, label: r.label }));
    items.push({ href: '/', label: 'Plumbmonkey Home' });
    items.push({ href: exit.href, label: '✕  ' + exit.label, isExit: true });

    const total = items.length * (ROW_H + ROW_GAP) + 0.10;
    const backing = new THREE.Mesh(
      new THREE.PlaneGeometry(ROW_W + 0.04, total),
      new THREE.MeshBasicMaterial({ color: 0x05070b, transparent: true, opacity: 0.92 }));
    backing.position.z = -0.004;
    menu.add(backing);

    const title = new THREE.Mesh(
      new THREE.PlaneGeometry(ROW_W, 0.05),
      new THREE.MeshBasicMaterial({ map: rowTexture(roomLabel.toUpperCase(), 'current'),
                                    transparent: true }));
    title.position.y = total / 2 - 0.045;
    menu.add(title);

    let y = total / 2 - 0.105;
    menuRows = items.map((item) => {
      const current = item.href === exit.href && !item.isExit;
      const mat = new THREE.MeshBasicMaterial({
        map: rowTexture(item.label, current ? 'current' : 'idle'), transparent: true });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(ROW_W, ROW_H), mat);
      mesh.position.y = y - ROW_H / 2;
      y -= ROW_H + ROW_GAP;
      menu.add(mesh);
      return { mesh, item, mat,
               idle: mat.map,
               hover: rowTexture(item.label, 'hover'),
               hovered: false };
    });

    menuBuilt = true;
    return true;
  }

  function toggleMenu() {
    if (!menuBuilt && !buildMenu()) return;
    menu.visible = !menu.visible;
    if (!menu.visible) return;

    /* Place it an arm's length ahead, at eye height, yaw-facing the viewer.
       Pitch is dropped deliberately: a panel that tilts with your head is
       harder to read than one that stays upright. */
    camera.getWorldPosition(_a);
    camera.getWorldDirection(_d);
    _d.y = 0;
    if (_d.lengthSq() < 1e-6) _d.set(0, 0, -1);
    _d.normalize();
    menu.position.copy(_a).addScaledVector(_d, 0.85);
    menu.lookAt(_a.x, menu.position.y, _a.z);
  }

  function menuHit(hand) {
    if (!menu.visible || !menuRows.length) return null;
    hand.ctrl.getWorldPosition(_o);
    hand.ctrl.getWorldQuaternion(_q);
    _d.set(0, 0, -1).applyQuaternion(_q);
    raycaster.set(_o, _d);
    raycaster.far = 8;
    const hits = raycaster.intersectObjects(menuRows.map((r) => r.mesh), false);
    if (!hits.length) return null;
    return menuRows.find((r) => r.mesh === hits[0].object) || null;
  }

  /* ---------------------------------------------------------------
     Input.
     --------------------------------------------------------------- */
  function onSelectStart(hand) {
    const row = menuHit(hand);
    if (row) {
      /* Navigating ends the session — which is what leaving a room means. */
      window.location.href = row.item.href;
      return;
    }
    if (menu.visible) { menu.visible = false; return; }
    hand.aiming = true;
  }

  function onSelectEnd(hand) {
    if (!hand.aiming) return;
    hand.aiming = false;
    teleport();
    clearAim();
  }

  function readSticks() {
    for (const hand of hands) {
      const gp = hand.source && hand.source.gamepad;
      if (!gp || !gp.axes) continue;

      /* xr-standard: axes[2]/[3] are the thumbstick. Fall back to [0]/[1] for
         touchpad-only controllers. */
      const ax = gp.axes.length > 2 ? gp.axes[2] : (gp.axes[0] || 0);
      const ay = gp.axes.length > 3 ? gp.axes[3] : (gp.axes[1] || 0);

      /* Snap turn on the right hand only, latched so a held stick turns once. */
      if (hand.source.handedness === 'right') {
        if (!hand.turnLatch && Math.abs(ax) > STICK_ON) {
          snapTurn(ax > 0 ? -1 : 1);
          hand.turnLatch = true;
        } else if (hand.turnLatch && Math.abs(ax) < STICK_OFF) {
          hand.turnLatch = false;
        }
      }

      /* Left stick forward is an alternate teleport aim: hold to aim, release
         to go. Same commit path as the trigger. */
      if (hand.source.handedness === 'left') {
        if (!hand.aiming && ay < -STICK_ON) hand.aiming = true;
        else if (hand.aiming && ay > -STICK_OFF) { hand.aiming = false; teleport(); clearAim(); }
      }

      /* Y (left) / B (right) — button 5 in the xr-standard mapping. */
      const b = gp.buttons && gp.buttons[5];
      if (b && b.pressed && !hand.menuLatch) { hand.menuLatch = true; toggleMenu(); }
      else if (b && !b.pressed) { hand.menuLatch = false; }
    }
  }

  /* ---------------------------------------------------------------
     Session lifecycle.
     --------------------------------------------------------------- */
  const desktop = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), target: new THREE.Vector3() };

  renderer.xr.addEventListener('sessionstart', () => {
    api.presenting = true;
    if (button) button.textContent = 'Exit VR';

    desktop.pos.copy(camera.position);
    desktop.quat.copy(camera.quaternion);
    if (controls) { desktop.target.copy(controls.target); controls.enabled = false; }

    camera.position.set(0, 0, 0);
    camera.quaternion.identity();

    /* Drop the player at the room's entry point. The floor height is found by
       raycasting rather than hard-coded, so a raked auditorium floor works. */
    rig.rotation.set(0, spawn.yaw || 0, 0);
    rig.position.set(spawn.x, 0, spawn.z);
    if (walkableMeshes.length) {
      raycaster.set(new THREE.Vector3(spawn.x, 40, spawn.z), down);
      raycaster.far = 200;
      const hits = raycaster.intersectObjects(walkableMeshes, false);
      if (hits.length) rig.position.y = hits[0].point.y;
    }

    if (renderer.xr.setFoveation) renderer.xr.setFoveation(1);
  });

  renderer.xr.addEventListener('sessionend', () => {
    api.presenting = false;
    if (button) button.textContent = buttonLabel;

    clearAim();
    menu.visible = false;
    for (const h of hands) { h.aiming = false; h.turnLatch = false; h.menuLatch = false; }

    rig.position.set(0, 0, 0);
    rig.rotation.set(0, 0, 0);

    /* Restore the desktop view. Without this the camera keeps whatever pose the
       headset last had, because three decomposes the XR pose into it. */
    camera.position.copy(desktop.pos);
    camera.quaternion.copy(desktop.quat);
    if (controls) { controls.target.copy(desktop.target); controls.enabled = true; controls.update(); }
    camera.updateProjectionMatrix();
  });

  /* ---------------------------------------------------------------
     Per-frame. Cheap and early-out on desktop.
     --------------------------------------------------------------- */
  /* Console hook, in the spirit of the theatre viewer's window.__sgt. This
     phase cannot be exercised in a desktop browser at all — no immersive
     session, no controllers — so the Quest browser's remote inspector is the
     only place most of this can be checked. Everything needed to diagnose it
     from there is reachable from here. */
  window.__pmxr = api;
  api.debug = {
    rig, scene, hands, menu, renderer, camera,
    get walkable() { return walkableMeshes.map((m) => m.name); },
    get landing() { return landingValid ? landing.toArray().map((v) => +v.toFixed(2)) : null; },
    buildMenu, toggleMenu, snapTurn,
    /* Drop the rig somewhere on foot, as a teleport would, without a headset. */
    goTo(x, z) {
      raycaster.set(new THREE.Vector3(x, 40, z), down);
      raycaster.far = 200;
      const h = raycaster.intersectObjects(walkableMeshes, false);
      if (!h.length) return null;
      landing.copy(h[0].point); landingValid = true; teleport(); landingValid = false;
      return rig.position.toArray().map((v) => +v.toFixed(2));
    },
  };

  function update() {
    if (!api.presenting) return;

    readSticks();

    let aimingHand = null;
    for (const h of hands) if (h.aiming) { aimingHand = h; break; }
    if (aimingHand && walkableMeshes.length) aim(aimingHand);
    else if (arc.visible) clearAim();

    /* Hover feedback on the menu, and shorten the pointer ray to whatever it
       is actually touching so it reads as a pointer, not a laser to infinity. */
    if (menu.visible) {
      const hovered = new Set();
      for (const h of hands) {
        const row = menuHit(h);
        if (row) hovered.add(row);
      }
      for (const row of menuRows) {
        const on = hovered.has(row);
        if (on !== row.hovered) {
          row.hovered = on;
          row.mat.map = on ? row.hover : row.idle;
          row.mat.needsUpdate = true;
        }
      }
    }

    for (const h of hands) h.line.visible = !h.aiming;
  }

  return api;
}
