"""Report every external dependency in a .blend, then pack them into it.

A .blend does not contain its textures by default — it stores *paths* to them.
Move, rename or clean out the folder they point at and the file opens with the
materials intact and the images gone. That is how a project becomes "needs
rebuilding" without anyone deleting the .blend.

VictorianHousev6 has 15 of these right now: the foyer paintings all point at
absolute paths under OneDrive\\Desktop\\Audio\\Rhythm of the Ritual\\..., which
is a working folder, not an asset library.

Run it read-only first to see what a file depends on:

    blender -b --factory-startup "some.blend" --python pack_and_archive.py

Then pack and write a self-contained copy alongside the original:

    blender -b --factory-startup "some.blend" --python pack_and_archive.py -- --write

The copy is named "<original>_packed.blend". The original is never modified.

WHAT PACKING DOES NOT COVER
---------------------------
Packing embeds images, sounds, fonts and volumes. It does NOT embed:

  * Physics/point caches and simulation bakes (cloth, fluid, rigid body). Those
    live in a `blendcache_<name>` folder next to the .blend — copy it too, and
    keep it next to the packed file under the SAME base name or Blender will
    not find it.
  * Linked libraries. Packing does not pull a linked .blend in; it stays a
    reference. This script reports them and can localise them with --make-local,
    which is usually what you want for archiving, but it is a one-way door:
    the result no longer tracks the source file.
  * Anything a add-on stores outside the .blend.
"""
import bpy, os, sys

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
WRITE = "--write" in argv
MAKE_LOCAL = "--make-local" in argv

src = bpy.data.filepath
print(f"\n=== {os.path.basename(src) or '(unsaved)'} ===")

missing, external, packed = [], [], []
for img in bpy.data.images:
    if img.source not in {'FILE', 'SEQUENCE', 'MOVIE'}:
        continue                       # generated / render results have no file
    if img.packed_file:
        packed.append(img.name)
        continue
    abspath = bpy.path.abspath(img.filepath)
    (missing if not os.path.exists(abspath) else external).append((img.name, abspath))

for label, items in (("MISSING", missing), ("external, not packed", external)):
    if not items:
        continue
    print(f"\n{len(items)} image(s) {label}:")
    seen_dirs = {}
    for name, path in items:
        seen_dirs.setdefault(os.path.dirname(path), []).append(name)
    for d, names in seen_dirs.items():
        print(f"  {d or '(relative)'}")
        for n in names:
            print(f"      {n}")
if packed:
    print(f"\n{len(packed)} image(s) already packed.")

for coll, label in ((bpy.data.sounds, "sound"), (bpy.data.fonts, "font"),
                    (bpy.data.volumes, "volume")):
    ext = [d.name for d in coll
           if getattr(d, "filepath", "") and not getattr(d, "packed_file", None)]
    if ext:
        print(f"\n{len(ext)} {label}(s) not packed: {', '.join(ext)}")

libs = [l.filepath for l in bpy.data.libraries]
if libs:
    print(f"\n{len(libs)} LINKED LIBRARY(ies) — packing will NOT embed these:")
    for l in libs:
        print(f"  {l}  ->  {bpy.path.abspath(l)}")
    print("  Re-run with --make-local to pull them in (one-way).")

cache = os.path.join(os.path.dirname(src), f"blendcache_{os.path.splitext(os.path.basename(src))[0]}")
if os.path.isdir(cache):
    n = len(os.listdir(cache))
    print(f"\nSimulation cache alongside this file ({n} files):\n  {cache}"
          "\n  Not packable — copy it manually, next to the packed .blend, same base name.")

if not WRITE:
    print("\nRead-only. Re-run with `-- --write` to pack and save a copy.\n")
else:
    if MAKE_LOCAL and libs:
        bpy.ops.object.make_local(type='ALL')
        print("\nmade linked data local")
    bpy.ops.file.pack_all()
    out = os.path.splitext(src)[0] + "_packed.blend"
    # compress: these files are mostly mesh and pack well, and the packed
    # images make them considerably larger.
    bpy.ops.wm.save_as_mainfile(filepath=out, compress=True, copy=True)
    before = os.path.getsize(src) / 1e6
    after = os.path.getsize(out) / 1e6
    print(f"\nwrote {out}\n  {before:.1f} MB -> {after:.1f} MB (original untouched)\n")
