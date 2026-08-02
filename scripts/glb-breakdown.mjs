/**
 * Reports what a .glb is actually made of: JSON scene graph vs BIN, and the
 * accessor/bufferView counts that reveal scene-graph bloat.
 *
 * Written for Phase 4 (see docs/handoffs/nav-unification-and-vr-plan.md). It is
 * what showed the theatre carrying 9,414 bufferViews for 355 primitives — ~26
 * per primitive against the gallery's 1.2 — which is why 41% of that file is
 * JSON rather than model.
 *
 *   node scripts/glb-breakdown.mjs
 */
import { readFileSync } from 'node:fs';
for (const [path,label] of [['public/gallery/gallery-web.glb','GALLERY'],['public/theatre/theatre-web.glb','THEATRE']]) {
  const buf = readFileSync(path); const total = buf.length;
  let off = 12, jsonLen = 0, binLen = 0, json = null;
  while (off < total) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off+4);
    if (type === 0x4E4F534A) { jsonLen = len; json = JSON.parse(new TextDecoder().decode(buf.subarray(off+8, off+8+len))); }
    if (type === 0x004E4942) binLen = len;
    off += 8 + len + ((4 - (len % 4)) % 4);
  }
  const mb = n => (n/1048576).toFixed(2);
  console.log(`\n${label}: ${mb(total)} MB = JSON ${mb(jsonLen)} + BIN ${mb(binLen)}`);
  console.log(`  accessors ${json.accessors?.length||0} · bufferViews ${json.bufferViews?.length||0} · meshes ${json.meshes?.length||0} · nodes ${json.nodes?.length||0}`);
  const prims = (json.meshes||[]).reduce((s,m)=>s+(m.primitives?.length||0),0);
  console.log(`  primitives ${prims} · draco-compressed ${(json.meshes||[]).reduce((s,m)=>s+(m.primitives||[]).filter(p=>p.extensions?.KHR_draco_mesh_compression).length,0)}`);
}
