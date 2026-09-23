# FRL Field OS V4

Adaptive, local-first smartphone PWA for first-response documentation and field sensor fusion.

## V4 changes

- Conversational first-response workflow with voice prompts and speech-to-text when the browser supports it.
- Adaptive prompt insertion: major haemorrhage, resuscitation status, focused breathing, trauma, neurological findings, environment/exposure, and early reassessment.
- Full responder transcript is preserved. Parsed vitals are separately tagged as manually dictated measurements.
- Existing patient, scene, environment, mapping, hazmat, timeline, archive, ATMIST handover and export tools remain available.
- Complete PWA package now includes CSS, web manifest and service worker.
- Local-first incident storage in browser storage; TXT, JSON and CSV outputs remain exportable.

## Run locally

```bash
python -m http.server 8080
```

Open `http://localhost:8080` on desktop. Camera, microphone, geolocation and speech features generally require HTTPS on phones, so GitHub Pages is the intended field test host.

## Important

This is a research/prototyping tool and assessment/documentation aid, not an autonomous medical device. Experimental camera-derived values and remote environmental/model data must remain visibly distinct from validated measurements and direct observations. Responder training, local protocols, emergency dispatch and hands-on care take priority.
