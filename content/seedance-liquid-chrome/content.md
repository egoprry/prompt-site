Image-to-video workflow. Generate the still first (frame attached), then feed it to Seedance 2.0 with the motion prompt.

## Still (any image model)

```
macro shot of a sphere of liquid chrome hovering above a dark studio floor,
perfect mirror reflections of unseen colored lights, dust particles in the
air, black background, 85mm lens
```

## Motion prompt

```
the chrome sphere slowly deforms into a rippling liquid ribbon, twisting in
place, reflections sliding across its surface, camera locked off, studio
lights flickering between magenta and cyan, seamless loop
```

- `camera locked off` is doing the heavy lifting — Seedance loves to orbit and it ruins the loop
- Ask for `seamless loop` and generate 5s; the loop point lands around 4.2s
