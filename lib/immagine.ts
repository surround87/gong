/**
 * A photo straight from a phone is several megabytes, and base64 inflates it by
 * a third — past the request body limit of the serverless function that reads
 * it. Shrinking it here also makes the read faster and cheaper, and a workout
 * card stays perfectly legible: it's text on paper, not a portrait.
 */

const LATO_MASSIMO = 1600;
const QUALITA = [0.82, 0.7, 0.55];
/** Comfortably under the 4.5 MB body limit, leaving room for the rest of the payload. */
const BYTE_MASSIMI = 3_000_000;

export function stimaByteBase64(base64: string): number {
  return Math.ceil((base64.length * 3) / 4);
}

async function disegna(file: File): Promise<HTMLCanvasElement | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decodifica fallita"));
      el.src = url;
    });

    const lato = Math.max(img.width, img.height);
    const scala = lato > LATO_MASSIMO ? LATO_MASSIMO / lato : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scala);
    canvas.height = Math.round(img.height * scala);

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // A white ground keeps transparent PNGs from turning black as JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Returns a JPEG small enough to upload, or null when the browser can't decode
 * the file — in which case the caller falls back to the original bytes.
 */
export async function comprimiImmagine(
  file: File,
): Promise<{ mediaType: string; base64: string } | null> {
  const canvas = await disegna(file);
  if (!canvas) return null;

  for (const q of QUALITA) {
    const dataUrl = canvas.toDataURL("image/jpeg", q);
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    if (stimaByteBase64(base64) <= BYTE_MASSIMI) {
      return { mediaType: "image/jpeg", base64 };
    }
  }
  return null;
}

export { BYTE_MASSIMI };
