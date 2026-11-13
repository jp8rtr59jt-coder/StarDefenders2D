# Milestone 3D — physical combat laboratory

Full instructions, configuration, native-system assessment, damage measurements,
reaction captures, regression records and remaining limitations:
[docs/physical-combat/README.md](../docs/physical-combat/README.md).

```sh
python3 offline/launch.py --no-browser
```

Open in Chrome on macOS:
`http://127.0.0.1:8000/?mode=combat&movement=1&art=1&physical=1`.
Click **Start combat sandbox**. The initial target is passive; enable Hostility
for active AI. Existing weapon, movement, art and construction controls remain.

The optional lab has its own disposable storage namespace. Original worlds and
existing game modes are preserved. No Node game server or internet is needed.

Stage 1 checkpoint commit: `5458bed099ae6532ce43972d17b4d6b9602edeaa`.
No final balance, artistic identity, medical realism or subjective combat feel
is established by automated tests.
