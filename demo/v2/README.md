# Demo v2: motion-graphics walkthrough

- `capture.py`: takes 2x DPR captures of the live site. Job #8 states are replayed by intercepting `/api/jobs/8` with the real mainnet data.
- `index.html` + `timeline.js`: an HTML/CSS scene with a deterministic `render(t)` that drives the camera, cursor, lower thirds and cards.
- `render.py`: renders 60 fps frame by frame in headless Chrome and pipes to ffmpeg, which writes `../demo-v2.mp4`. Run `python3 render.py 60 "t1,t2"` to write review stills.

Music: "Chills" by Holizna, CC0 (public domain), from https://opengameart.org/content/chills
