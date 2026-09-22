# V4 Geometry Pipeline

## Rendering principle

The visible experience remains particle-only. Hidden meshes are used solely as sampling surfaces for particle attractors.

The renderer keeps one persistent particle universe. Geometry does not appear directly; particles flow toward sampled surface targets, circulate, detach, and return to the ambient field.

## Human

### Eugene v0.2

Source anatomy:
- Vitruvian CC0 human head from `ibrews/VitruvianGodot`
- Pinned source commit: `bdecdcd537b4031fdd0fb299b7e4f93f084fffa0`

License:
- Character/head assets explicitly CC0 1.0.

Identity fit:
- public-reference v0.2 deformation only.
- The fit remains deliberately conservative, but v0.2 adds feature-weighted formation and refined: facial length, cheek width, lower-jaw profile, nose bridge/tip projection, cheekbone planes, brow plane, chin projection, and subtle asymmetry after surface sampling.
- Public photographs are references only and are not bundled or redistributed.
- This is not a photogrammetric reconstruction. A controlled multi-angle capture can later replace the v0.1 fit.

## Animals

### Eagle
- CC0 bald-eagle GLB from 3DAssets.dev
- CDN asset ID: 20643
- Surface-sampled at runtime.
- Portrait crop isolates the cranial/upper structure.

### Dog
- Gobkit CC0 Corgi GLB.
- Pinned source commit: `0d654ab3306515b1b63621a5c6548554034482dc`

### Bat
- Gobkit CC0 Bat GLB.
- Same pinned source commit.

### Shark
- Gobkit CC0 Shark GLB.
- Same pinned source commit.

### Migratory bird
- Gobkit CC0 Duck GLB.
- Same pinned source commit.
- Duck is used as a biologically valid migratory-bird geometry source rather than as a generic symbolic bird.

### Star-nosed mole
- Attempts to load the CC0 3DAssets.dev Molehill/mole geometry as a soft-tissue base.
- A generated 22-ray star-nose geometry is added after normalization.
- If the remote mole asset cannot be resolved, the site automatically keeps the existing procedural mole fallback rather than breaking the scene.

## Fallback behavior

Every mesh-backed subject has a procedural fallback. The site can therefore render immediately and remain functional if:
- a CDN request is delayed,
- a source is temporarily unreachable,
- the GLB parser rejects an asset,
- or sampling fails.

When a real mesh finishes loading, the active scene's particle targets are regenerated automatically.

## Runtime geometry sampling

The site uses:
- Three.js GLTFLoader
- Three.js MeshSurfaceSampler
- surface target normalization
- portrait cropping
- per-subject fit transforms
- one shared particle simulation

No source mesh is displayed.

## Next geometry pass

1. Review the live Eugene v0.2 proportions.
2. Correct head orientation if the source GLB resolves backwards.
3. Tune crop windows for eagle/dog/bat/shark/bird from live behavior.
4. Replace the generic mole base if a cleaner CC0 star-nosed-mole scan becomes available.
5. Replace Eugene v0.2 with controlled multi-angle capture when available.
