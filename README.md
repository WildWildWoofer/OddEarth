# The Odd Earth Institute — Website V1

**Elucidating the underpinnings of human capacity.**

This is the public-facing V1 for The Odd Earth Institute. It is a static, GitHub-Pages-ready scrollytelling site built around a generative particle/wave visual system.

## Thesis

Life contains extraordinary sensory specialists. Odd Earth studies the physics, biology and learning underlying those capabilities, then asks what can be trained, amplified or translated into human perception.

The site moves through:

1. Vision — eagle
2. Active acoustics — bat
3. Chemical space — dog
4. Touch — star-nosed mole
5. Field sensing — shark
6. Orientation — migratory bird
7. Inner Earth — interoception
8. The revealed human

## Technical approach

- Static HTML/CSS/JavaScript
- Three.js loaded from CDN
- Procedurally generated particle organisms
- Scroll-linked camera orbit and specimen transitions
- No build step
- No tracking or cookies
- Sensorium is linked as the Institute's experimental/training wing

## Run locally

A local HTTP server is recommended because the JavaScript uses ES modules:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Deploy on GitHub Pages

Settings → Pages → Deploy from a branch → `main` → `/ (root)`.

The expected public URL is:

`https://wildwildwoofer.github.io/OddEarth/`

## V1 design doctrine

- The human never becomes a cyborg.
- Animals are references, not a hierarchy.
- Visual effects should represent physical information, not generic HUD decoration.
- Wonder should lead to mechanism, and mechanism should lead to an experiment.
- The site should become more human, not less, as it progresses.
