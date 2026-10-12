"""Generates a self-authored, Mars-like equirectangular texture.

Not a NASA photograph: this sandbox cannot reach NASA.gov, Wikimedia Commons,
or Solar System Scope (only GitHub + package registries are reachable from
here), and the one convenient GitHub-hosted Mars texture found
(KyleGough/solar-system) credits a third-party source whose redistribution
terms for this project aren't clear, so it isn't used. This script instead
authors a procedural rust-red terrain with fractal noise, craters, darker
albedo regions and polar ice caps -- original, zero licensing risk, and far
more "alive" on a rotating 3D sphere than a flat CSS gradient. The frontend
labels it as a synthetic/procedural rendering, same honesty rule as the rest
of the project's imagery.
"""

import numpy as np
from PIL import Image, ImageFilter

rng = np.random.default_rng(7)

W, H = 1024, 512


def fractal_noise(w, h, octaves, persistence, base_scale):
    total = np.zeros((h, w), dtype=np.float64)
    amplitude = 1.0
    max_amp = 0.0
    for o in range(octaves):
        scale = max(2, base_scale * (2**o))
        small = rng.random((scale + 1, scale * 2 + 1))
        img = Image.fromarray((small * 255).astype(np.uint8), mode="L")
        img = img.resize((w, h), resample=Image.BICUBIC)
        total += amplitude * (np.asarray(img, dtype=np.float64) / 255.0)
        max_amp += amplitude
        amplitude *= persistence
    return total / max_amp


# Two independent fields: coarse albedo regions (where the classic dark
# Martian "maria" sit) and fine high-frequency grain (dust/terrain texture).
regions = fractal_noise(W, H, octaves=4, persistence=0.55, base_scale=4)
grain = fractal_noise(W, H, octaves=6, persistence=0.52, base_scale=14)

# Base palette blended from the coarse regions field (a gentler contrast
# curve than before, so it reads as terrain, not ink blots).
light_dust = np.array([214, 150, 108])
mid_rust = np.array([176, 97, 61])
dark_basalt = np.array([117, 61, 40])

r = np.clip((regions - 0.3) / 0.5, 0, 1)[..., None]
base = dark_basalt + r * (light_dust - mid_rust) + (mid_rust - dark_basalt) * 0.6

# Fine grain modulates brightness subtly (dust texture), not hue.
base = base * (0.88 + 0.24 * grain[..., None])

# A handful of circular craters: darker rim, slightly lighter floor.
n_craters = 55
xs = rng.integers(0, W, n_craters)
ys = rng.integers(0, H, n_craters)
radii = rng.integers(4, 26, n_craters)
yy, xx = np.mgrid[0:H, 0:W]
for cx, cy, rad in zip(xs, ys, radii):
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    rim = np.clip(1 - np.abs(d - rad) / (rad * 0.35), 0, 1)
    floor = np.clip(1 - d / (rad * 0.7), 0, 1)
    base = base - (rim[..., None] * 22) + (floor[..., None] * 10)

# Polar ice caps -- tight to the actual poles, ragged edge from the grain field.
lat = np.linspace(-1, 1, H)[:, None]
cap_strength = np.clip((np.abs(lat) - 0.88) / 0.12, 0, 1) ** 1.3
cap_strength = cap_strength * (0.7 + 0.3 * grain[:, :1])
ice = np.array([238, 236, 232])
base = base * (1 - cap_strength[..., None]) + ice * cap_strength[..., None]

rgb = np.clip(base, 0, 255).astype(np.uint8)
img = Image.fromarray(rgb, mode="RGB")
img = img.filter(ImageFilter.GaussianBlur(radius=0.4))

out_path = "/tmp/claude-0/-home-claude/8487a843-0191-5cdd-826e-883821e9de41/scratchpad/textures/mars_1024.jpg"
img.save(out_path, quality=92)
print("saved", out_path, img.size)
