# Harmony Wheel

A color wheel and palette generator in plain HTML, CSS and JavaScript. It works like Adobe Color: pick a harmony rule, drag the markers, and get a 5-color palette that follows color theory.

## Features

- **Color wheel**: RYB (artist's wheel, like Adobe Color) or RGB. The angle on the wheel sets the hue, the distance from the center sets saturation, and the slider sets brightness.
- **Harmony rules**: Analogous, Monochromatic, Triad, Complementary, Split Complementary, Double Split Complementary, Square, Rectangle (Tetradic), Compound, Shades and Custom. Each rule shows a live preview built from your base color.
- **5 swatches** showing HEX, RGB and HSB. You can type a hex value into any swatch, copy it, or make that swatch the base color.
- **Harmonize**: enter your color and build the selected harmony around it.
- **Random**: generates a palette from a random "mood" (vibrant, pastel, muted, deep or balanced). The hues always follow the harmony rule, and you can also randomize the rule.
- **Light / dark mode**: follows your system setting by default and remembers your choice.
- **Export**: copy as HEX, CSS variables or JSON, download a PNG, or copy a share link. The current palette lives in the URL, so links reproduce it exactly.

## Controls

| Action | How |
| --- | --- |
| Move a color | Drag its marker (in rule modes, the whole set rotates so the harmony is kept) |
| Move the selected color | Click anywhere on the wheel |
| Rotate / saturation | Arrow keys while the wheel is focused (hold Shift for bigger steps) |
| Select a color | Keys `1` to `5`, or click a swatch |
| Random palette | `Space` |

## Publish on GitHub Pages

1. Create a new repository on GitHub, for example `harmony-wheel`.
2. Upload `index.html`, `style.css` and `script.js` to the root of the repository.
3. Open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then click **Save**.
4. After about a minute the site is live at `https://<your-username>.github.io/harmony-wheel/`.

The site has no build step and no dependencies. To try it locally, just open `index.html` in a browser.
