/**
 * Browser-only (except `fitWithin`): turn a photo into a small JPEG for upload. Phone photos
 * are often 3–8 MB; shrinking first means faster uploads, a much faster Gemini read, and
 * staying under the hosting body limit (4.5 MB).
 */
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/domain/schemas";

export const MAX_SIDE = 1600; // still sharp enough to read printed or handwritten text
export const JPEG_QUALITY = 0.75;

export type PhotoUpload = { mimeType: "image/jpeg"; base64: string };

export class PhotoTooLargeError extends Error {
  constructor() {
    super("That photo is still bigger than 4 MB after shrinking. Please choose a smaller one.");
    this.name = "PhotoTooLargeError";
  }
}

/** Target size with the longest side ≤ `max`, keeping the shape and never enlarging. */
export function fitWithin(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Plain-language problem with the chosen file type, or null. Size is checked after shrinking. */
export function photoProblem(file: File): string | null {
  return (IMAGE_TYPES as readonly string[]).includes(file.type) ? null : "Please choose a JPEG, PNG or WebP photo.";
}

/** Shrink to ≤ 1600px as JPEG 0.75, then enforce the 4 MB limit as a safety check. */
export async function photoToUpload(file: File): Promise<PhotoUpload> {
  const bitmap = await createImageBitmap(file);
  const size = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob) throw new Error("Could not prepare the photo");
  if (blob.size > MAX_IMAGE_BYTES) throw new PhotoTooLargeError();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return { mimeType: "image/jpeg", base64: dataUrl.slice(dataUrl.indexOf(",") + 1) };
}
