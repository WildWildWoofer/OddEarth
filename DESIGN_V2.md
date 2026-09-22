# V2 Art Direction — Living Specimen Architecture

## Central visual rule

The human body is the hero object.

Each animal appears beside the human as an evolutionary specialist solving the same information problem through different biology. Neither organism is an icon or mascot: both should feel like suspended, three-dimensional museum specimens made from living matter and signal.

## Rendering stack

Every organism has three visual layers:

1. **Anatomical surface**
   - Dense volumetric particle sampling.
   - Human proportions are built from head, jaw/neck, ribcage, waist, pelvis, articulated arms/legs, hands and feet.
   - Animal bodies use equivalent spatial construction rather than flat outlines.

2. **Internal anatomy**
   - Lower-opacity anchors reveal selected internal structure.
   - In the human this includes thoracic mass, cardiac/respiratory regions, spine and clavicular geometry.
   - Internal detail grows as the site approaches Inner Earth.

3. **Information field**
   - Vision: directional rays.
   - Echolocation: expanding pressure shells.
   - Smell: turbulent chemical plume.
   - Touch: surface microtopography.
   - Electroreception: electric field contours.
   - Orientation: field rings.
   - Interoception: cardiac and respiratory rhythms.

## Composition

- Human sits close to center and is generally larger/more detailed than the animal.
- Animal is offset beside the human rather than mirrored.
- Scroll controls a slow orbital camera movement around the pair.
- Text occupies the periphery and should never become the visual subject.

## Particle behavior

Particles are soft circular sprites rendered with a custom shader:
- depth-scaled point size,
- subtle per-particle luminance variance,
- small biological motion rather than sparkle,
- additive glow only where useful,
- denser anatomy than surrounding signal fields.

## Design doctrine

- Biology first, instrumentation second.
- No generic sci-fi HUD clutter.
- No cyborg transformation.
- Animals are specialist references, not a hierarchy.
- Wonder must resolve into mechanism.
- Mechanism must resolve into an experiment.
- The site becomes increasingly human as it progresses.

## V2 target feeling

Natural-history museum × anatomy atlas × psychophysics laboratory × volumetric particle sculpture.
