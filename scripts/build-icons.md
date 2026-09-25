# Rebuilding the app icons

The three SVGs in `public/` are the masters. Everything else in the icon set
is rendered from them, so **never redraw the R** — edit the master and
re-export.

| master | used for | why it is its own file |
|---|---|---|
| `icon.svg` | every `icon-*.png`, `apple-touch-icon.png` | the mark |
| `icon-maskable.svg` | `icon-maskable-*.png` | mark scaled to 0.8 for Android's crop |
| `favicon.svg` | `favicon-16/32.png`, `favicon.ico` | the same letter scaled up for 16px — see its comment |

The letter itself lives in exactly one place: the three `<path>` elements are
byte-identical across all three masters, and the variants differ only by a
`transform` on the group. **Edit the paths in `icon.svg` and paste them into
the other two** — or the three will drift and nobody will notice until the
favicon stops matching the home-screen icon.

**The ball is in two of the three, on purpose.** `icon.svg` and
`icon-maskable.svg` carry it; `favicon.svg` does not, because at 16px it is
1.7 physical pixels and at 32px a small gold dot in the corner of a browser
tab reads as an unread badge. That is the one sanctioned difference between
the masters and the reason is written out in `favicon.svg` itself.

**There is a fourth copy of the letter, and it is not in this folder.**
`src/components/ui/RallyMark.tsx` draws the same paths for the mark in the
app's header, in theme tokens rather than fixed hexes. Change the geometry
here and it has to change there too.

## Why there is no one-command build

This machine has no rasteriser. `sharp` is not installed (Next does not pull
it in on Windows), there is no ImageMagick — `convert` on PATH is Windows'
own disk-conversion tool, which is a trap worth knowing about — and adding a
native image dependency to build eleven flat PNGs is a bad trade.

So the rasteriser is the browser, which is already here and already correct
about SVG. The procedure below is what produced the current set.

## The procedure

1. Start the dev server (`npm run dev`, or the `rally-dev` preview config).

2. Add a temporary API route at `src/pages/api/_icons.ts` that writes a
   base64 body to `public/`. **Delete it before committing** — it writes files
   from an unauthenticated request, which is fine on localhost and is not
   something to ship even behind a dev check:

   ```ts
   import { writeFileSync } from "fs";
   import { join } from "path";
   export default function handler(req: any, res: any) {
     if (process.env.NODE_ENV === "production") return res.status(404).end();
     const { name, data } = req.body || {};
     if (!/^[a-z0-9._-]+\.(png|ico)$/i.test(name)) return res.status(400).end();
     writeFileSync(join(process.cwd(), "public", name),
       Buffer.from(String(data).replace(/^data:[^,]+,/, ""), "base64"));
     res.json({ ok: true });
   }
   export const config = { api: { bodyParser: { sizeLimit: "8mb" } } };
   ```

   The point of the route is that the PNG bytes go straight from the canvas to
   disk. Passing them back through a conversation as base64 costs a great deal
   and gains nothing.

3. On any page of the running app, in the console:

   ```js
   const render = async (src, size) => {
     const txt = await (await fetch(src)).text();
     const url = URL.createObjectURL(new Blob([txt], { type: "image/svg+xml" }));
     const img = new Image();
     await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
     const c = document.createElement("canvas");
     c.width = c.height = size;
     const g = c.getContext("2d");
     g.imageSmoothingQuality = "high";
     g.drawImage(img, 0, 0, size, size);
     URL.revokeObjectURL(url);
     return c.toDataURL("image/png");
   };
   const save = (name, data) =>
     fetch("/api/_icons", { method: "POST", headers: { "content-type": "application/json" },
                            body: JSON.stringify({ name, data }) }).then((r) => r.json());

   for (const s of [1024, 512, 384, 192, 180, 152, 144, 128, 96, 72, 48])
     await save(s === 180 ? "apple-touch-icon.png" : `icon-${s}.png`, await render("/icon.svg", s));
   for (const s of [512, 192])
     await save(`icon-maskable-${s}.png`, await render("/icon-maskable.svg", s));
   for (const s of [32, 16])
     await save(`favicon-${s}.png`, await render("/favicon.svg", s));
   ```

4. Pack the `.ico`, which IS a real script because that part needs no
   rasteriser — an `.ico` since Vista may hold PNGs verbatim:

   ```
   node scripts/build-favicon-ico.js public
   ```

5. Delete `src/pages/api/_icons.ts`.

6. **Look at the result at 16px, magnified.** Not optional, and the reason
   the letterform is what it is. The first draft had an elliptical bowl and a
   128 stroke; at 16px its counter was 1.7 physical pixels, closed completely,
   and the R became a lime blob — invisible in every view except a magnified
   one, and invisible in the 512px render that looked fine. Draw a contact
   sheet onto a canvas with `imageSmoothingEnabled = false`, scaled 10-14x,
   and save it the same way.

   Compare against a reference the same way if there is one. Sam's mockup
   sat beside the render at matched size, which is what made the difference
   obvious: an ellipse where a stadium was wanted, and a leg growing out of
   the stem instead of out of the bowl. Neither was visible while looking at
   the icon on its own.

## Rules that are easy to break

- **No rounded corners in the master.** iOS and Android apply their own mask.
  A pre-rounded icon is rounded twice and shows a pale seam at each corner.
- **No transparency.** The field is part of the mark; the full-bleed rect is
  what guarantees it.
- **The maskable is `"purpose": "maskable"` only**, never also `"any"`. A
  launcher that applies no mask would show a small letter adrift in a tile.
- **`icon-1024.png` is in the set** because the brief asked for it. Nothing
  serves it to a browser; it is there so the largest size exists without a
  re-export.
