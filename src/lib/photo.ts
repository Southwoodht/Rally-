// Reads an image file into a small square JPEG data URL, cropped to a
// center square of `size`x`size`. Shared by anything that lets someone
// upload a photo (profile pictures, match photos).
//
// iPhone camera-roll photos are usually HEIC, which the classic <img>
// decoder often can't read — failing completely silently, so nothing
// appears to happen. createImageBitmap decodes far more formats reliably
// (including HEIC on modern mobile browsers), so it's tried first; the
// FileReader/Image path is only a fallback for older browsers.
export function readPhotoAsDataUrl(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) { reject(new Error("not-an-image")); return; }
    const draw = (source: CanvasImageSource, w: number, h: number) => {
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("no-canvas-context")); return; }
      const side = Math.min(w, h);
      const sx = (w - side) / 2, sy = (h - side) / 2;
      ctx.drawImage(source, sx, sy, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    (async () => {
      if (typeof createImageBitmap === "function") {
        try {
          const bitmap = await createImageBitmap(file);
          draw(bitmap, bitmap.width, bitmap.height);
          bitmap.close?.();
          return;
        } catch {
          // fall through to the FileReader/Image path below
        }
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read-failed"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("decode-failed"));
        img.onload = () => draw(img, img.width, img.height);
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    })();
  });
}
