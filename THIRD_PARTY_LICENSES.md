# Third-party assets

## Pixel icons (ghost, rocket, sparkle)

Adapted from **shuqikhor/pixel-icons** — https://github.com/shuqikhor/pixel-icons
Copyright (c) 2023 shuqikhor. Used under the MIT License (full text below).

The three icons used in this project (`frontend/src/components/ui/icons.jsx`) keep the
original pixel-grid geometry but have their fill colors remapped onto PixelForge's own
palette. No other files from the upstream repository are used.

```
MIT License

Copyright (c) 2023 shuqikhor

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Testing-area sprite dummies (square + isometric)

Two composited walk-cycle spritesheets power the Tile Tester's "Sprite" dummy mode
(`frontend/src/utils/heroSprite.js`, `heroSpriteAssets.js`). Both are built entirely by
layering official released art from two open-source game projects — nothing hand-drawn
or AI-generated, and no recoloring, only compositing (stacking existing layers together
and, for the isometric one, re-slicing which directions are kept).

### Square dummy — `frontend/src/assets/sprites/square-dummy-walk.png`

Composited from four layers of the **Liberated Pixel Cup "Universal LPC Spritesheet"**
project — https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator —
stacking each layer's `walk.png` (body, then pants, then t-shirt, then hair) into one
9-frame × 4-direction (up/left/down/right) sheet, per that repo's own `CREDITS.csv`:

| Layer | Path in upstream repo | Authors | License used here |
|---|---|---|---|
| Body | `spritesheets/body/bodies/male/walk.png` | bluecarrot16, JaidynReiman, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sjölund (wulax), Stephen Challener (Redshrike) | CC BY-SA 3.0 |
| Pants | `spritesheets/legs/pants/male/walk.png` | bluecarrot16, JaidynReiman, Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) | CC BY-SA 3.0 |
| T-shirt | `spritesheets/torso/clothes/shortsleeve/tshirt/male/walk.png` | Eliza Wyatt (ElizaWy), JaidynReiman, Stephen Challener (Redshrike), Johannes Sjölund (wulax) | OGA-BY 3.0 |
| Hair | `spritesheets/hair/bedhead/adult/walk.png` | JaidynReiman, Manuel Riecke (MrBeast) | CC BY-SA 3.0 |

Original OpenGameArt submissions these layers trace back to (per CREDITS.csv):
https://opengameart.org/content/liberated-pixel-cup-lpc-base-assets-sprites-map-tiles ·
https://opengameart.org/content/lpc-medieval-fantasy-character-sprites ·
https://opengameart.org/content/lpc-revised-character-basics ·
https://opengameart.org/content/lpc-expanded-pants ·
https://opengameart.org/content/lpc-expanded-simple-shirts ·
https://opengameart.org/content/lpc-expanded-hair

**CC BY-SA 3.0** (body, pants, hair) — free to use, adapt, and redistribute, including
commercially, provided you credit the authors above and license any adaptation you
distribute under this same license. Full legal code:
https://creativecommons.org/licenses/by-sa/3.0/legalcode

**OGA-BY 3.0** (t-shirt only — that layer isn't offered under CC BY-SA/GPL) —
OpenGameArt's own attribution license, equivalent to CC BY 3.0 with the anti-DRM clause
removed. Free to use and adapt, including commercially, provided you credit the
author(s) above. Full legal code: https://static.opengameart.org/OGA-BY-3.0.txt

### Isometric dummy — `frontend/src/assets/sprites/iso-dummy-walk.png`

Composited from five layers of **Flare**'s (flareteam/flare-game) open-source isometric
avatar art — https://github.com/flareteam/flare-game — stacking `feet → legs → hands →
chest → head_short` for the game's default unarmed male avatar
(`mods/fantasycore/images/avatar/male/`), using the exact z-order and per-frame anchor
offsets from Flare's own `mods/fantasycore/engine/hero_layers.txt` and
`mods/fantasycore/animations/avatar/male/*.txt` so the layers align correctly. Re-sliced
from Flare's native 8-directional `[run]` cycle down to the 4 diagonal directions
(nw/ne/sw/se) this project's isometric grid actually uses, and re-used across all 4
isometric ratio presets rather than made once per ratio — see the comment at the top of
`heroSprite.js` for why (in short: pixel-art sprites drawn at exactly 45°/36.87°/30° don't
really exist anywhere — pixel artists converge on the 2:1 "classic" angle for technical
reasons, and real isometric games billboard their character art unskewed regardless of
the floor's projection angle, same as this project's procedural dummy already did).

Authors: the Flare project's contributors, as listed in the repository's own
`CREDITS.txt` (https://github.com/flareteam/flare-game/blob/master/CREDITS.txt) — credited
at the project level rather than per-file, since (unlike the LPC project above) Flare's
repo doesn't itemize individual sprite authorship per file.

**License: CC BY-SA 3.0**, per Flare's repository `LICENSE.txt`. Free to use, adapt, and
redistribute, including commercially, provided you credit the Flare project and license
any adaptation you distribute under this same license. Full legal code:
https://creativecommons.org/licenses/by-sa/3.0/legalcode

---

Everything else visual in this project (the PixelUniverse background, loading indicator,
cut-corner panel style, the procedural canvas dummy in `heroSprite.js`, etc.) is
original/procedural — plain code, no image assets.
