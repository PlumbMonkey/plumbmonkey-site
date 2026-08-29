"""Rewrite the foyer's portal routes in public/foyer/foyer-web.glb, in place.

Plain Python — NOT a Blender script. Run it with:

    python scripts/blender/foyer_retarget.py            # apply
    python scripts/blender/foyer_retarget.py --check    # report drift only

Why this exists rather than just re-running stage2_export.py:

A portal's destination is only a glTF `extras` property on a transform-only
NAV_ empty. Changing one touches no geometry, no material and no texture. But
stage2 reads `foyer_stage1.blend`, which is a build intermediate that was not
kept — so re-exporting would mean re-running stage1_bake.py first and re-baking
about eighteen procedural materials, which is slow and risks the foyer coming
back looking subtly different for the sake of editing two strings.

So this patches the shipped asset directly, and reads its truth from the
PORTALS table in stage2_export.py. The two cannot drift: change PORTALS, run
this, and a future full re-export produces the same result. `--check` is the
guard that proves it, and is what to run if the foyer ever looks out of date.
"""
import ast
import json
import pathlib
import struct
import sys

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parent.parent
GLB = REPO / "public" / "foyer" / "foyer-web.glb"
STAGE2 = HERE / "stage2_export.py"

JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def portals_from_stage2():
    """Read the PORTALS dict without importing the module (it needs bpy)."""
    tree = ast.parse(STAGE2.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name) and t.id == "PORTALS":
                    return ast.literal_eval(node.value)
    raise SystemExit("no PORTALS table found in stage2_export.py")


def read_glb(path):
    d = path.read_bytes()
    magic, version, total = struct.unpack_from("<III", d, 0)
    if magic != 0x46546C67:
        raise SystemExit(f"{path} is not a GLB")
    if total != len(d):
        raise SystemExit(f"{path} header length {total} != file size {len(d)}")
    chunks, off = [], 12
    while off < len(d):
        clen, ctype = struct.unpack_from("<II", d, off)
        chunks.append((ctype, d[off + 8: off + 8 + clen]))
        off += 8 + clen
    return chunks


def write_glb(path, chunks):
    body = bytearray()
    for ctype, data in chunks:
        # The spec counts the alignment padding as part of chunkLength, which is
        # also what glTF-Blender-IO writes — so pad first, then declare.
        filler = b"\x00" if ctype == BIN_CHUNK else b" "
        data = data + filler * (-len(data) % 4)
        body += struct.pack("<II", len(data), ctype) + data
    out = struct.pack("<III", 0x46546C67, 2, 12 + len(body)) + bytes(body)
    path.write_bytes(out)
    return len(out)


def main():
    check_only = "--check" in sys.argv
    portals = portals_from_stage2()
    chunks = read_glb(GLB)
    if not chunks or chunks[0][0] != JSON_CHUNK:
        raise SystemExit("first GLB chunk is not JSON")

    g = json.loads(chunks[0][1].decode("utf-8"))
    changes, missing = [], []

    for key, (href, label, live) in portals.items():
        name = "NAV_" + key
        node = next((n for n in g.get("nodes", []) if n.get("name") == name), None)
        if node is None:
            missing.append(name)
            continue
        extras = node.setdefault("extras", {})
        # Mirror stage2 exactly, including its empty href on the unbuilt arches:
        # it writes e["href"] = href for every portal regardless of `live`, so
        # dropping the key here would itself be drift from a real re-export.
        # The viewer only tests truthiness, so "" and absent behave the same.
        for k, v in (("href", href), ("label", label), ("live", bool(live))):
            if extras.get(k) != v:
                changes.append(f"{name}.{k}: {extras.get(k)!r} -> {v!r}")
                extras[k] = v

    for m in missing:
        print(f"WARNING: {m} is in PORTALS but not in the glb")

    if not changes:
        print("foyer portals already match stage2_export.py — nothing to do")
        return 0

    for c in changes:
        print(("DRIFT  " if check_only else "patch  ") + c)

    if check_only:
        print(f"\n{len(changes)} difference(s). Run without --check to apply.")
        return 1

    chunks[0] = (JSON_CHUNK, json.dumps(g, separators=(",", ":")).encode("utf-8"))
    before = GLB.stat().st_size
    after = write_glb(GLB, chunks)
    print(f"\nrewrote {GLB.relative_to(REPO)} — {before} -> {after} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
