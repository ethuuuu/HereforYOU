/**
 * Browser-only: turn a photo into a small JPEG for upload. Phone photos are often 3–8 MB;
 * shrinking keeps the request under the hosting body limit (4.5 MB) and speeds up Gemini.
 */
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/domain/schemas";

const MAX_SIDE = 1600; // still sharp enough to read printed or handwritten text

export type PhotoUpload = { mimeType: "image/jpeg"; base64: string };

/** Plain-language problem with the chosen file, or null if it's fine. */
export function photoProblem(file: File): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return "Please choose a JPEG, PNG or WebP photo.";
  if (file.size > MAX_IMAGE_BYTES) return "That photo is bigger than 4 MB. Please choose a smaller one.";
  return null;
}

export async function photoToUpload(file: File): Promise<PhotoUpload> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Could not prepare the photo");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return { mimeType: "image/jpeg", base64: dataUrl.slice(dataUrl.indexOf(",") + 1) };
}
