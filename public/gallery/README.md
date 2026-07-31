# Victorian Haunted Gallery — 3D assets

Exported from `PlumbmonkeyManor_Gallery_v1.blend` (Blender 5.1, EEVEE), 2026-07-30.

| File | Size | Use |
|---|---|---|
| `gallery-web.glb` | **5.47 MB** | **Use this on the site.** Draco-compressed, JPEG textures, no lights. |
| `gallery.glb` | 14.89 MB | **Not deployed** — gitignored. Uncompressed reference export with punctual lights, kept in the Blender project archive for editing. |

## Loading

`gallery-web.glb` is **Draco-compressed** — the loader needs a `DRACOLoader` attached or it will
fail to parse:

```js
const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
new GLTFLoader().setDRACOLoader(draco).load('/gallery/gallery-web.glb', onLoad);
```

- **Units:** metres. Hall interior is 24 × 30 m, 12 m to the vault apex.
- **Orientation:** Y-up (glTF convention), converted on export.
- **Animation:** one 240-frame idle loop at 24 fps — rotating fountain mist, drifting curtains,
  per-candle flicker, a lightning flash around frame 148, and the Victorian house scale model
  turning on its plinth (plinth 05).

## Interaction anchors

Empty objects export as named, transform-only nodes. Use them as hit targets / teleport points
rather than raycasting geometry:

| Node prefix | Meaning |
|---|---|
| `NAV_Pedestal_01..08` | Open the model viewer for that exhibit |
| `NAV_Art_*` | Open the artwork — each carries the source filename |
| `NAV_Wing_EN/ES/WN/WS` | Enter an exhibition wing |
| `NAV_GrandStair` | Future character gallery |
| `NAV_Secret_Bookshelf` | Secret room |
| `NAV_CuratorDoor` | Future gallery expansion |
| `NAV_Fountain`, `NAV_Entrance` | Centrepiece / exit |
| `MOUNT_Pedestal_01..08` | Top surface of each plinth — parent incoming models here |

Cameras export too: `CAM_Hero`, `CAM_Arrival`, `CAM_Exhibits`, `CAM_WingEN`, `CAM_Balcony`,
`CAM_BalconyOverlook`, `CAM_Fountain`, `CAM_MiniKit`. `CAM_Arrival` is the intended entry view.

## What is deliberately NOT in the GLB

These have no glTF representation and need a web-side equivalent:

- **Volumetric fountain mist** — was a Principled Volume. Needs a shader/particle effect.
- **World fog** and **dust motes** — same.
- **Sky dome and exterior terrain** — procedural node materials; excluded. The windows will read as
  empty. Substitute a skybox or a simple gradient plane.
- **Lighting.** `gallery-web.glb` ships with no lights at all, because the Blender scene uses 87 of
  them. The scene is authored dark and contrasty on purpose, so it will look wrong under a default
  ambient light. Either bake lightmaps (not done yet) or hand-place a small rig.
- 8 area lights were dropped even from `gallery.glb` — glTF supports only point, spot and
  directional.

## Cost

~300k triangles total, but no single viewpoint sees all of it — the main hall is ~203k and the
east-north wing ~236k. Wings are separate rooms and are good candidates for lazy loading.
