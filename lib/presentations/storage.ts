import "server-only";
import {
  contentDispositionFor as genericContentDisposition,
  deleteGeneratedFile,
  mimeTypeFor,
  readGeneratedFile,
  saveGeneratedFile,
} from "@/lib/storage/files";

/**
 * Prezentatsiya fayllari — `lib/storage/files.ts` ustidagi yupqa qatlam.
 *
 * Umumiy saqlagich Excel moduli qo'shilganda ajratib olindi. Bu fayl
 * saqlanib qoldi, chunki chaqiruvchilar har safar `"pptx"` turini
 * yozib yurmasin.
 */

export const PPTX_MIME_TYPE = mimeTypeFor("pptx");

export async function savePresentationFile(
  presentationId: string,
  buffer: Buffer,
): Promise<{ filePath: string; fileSize: number }> {
  return saveGeneratedFile("pptx", presentationId, buffer);
}

export async function readPresentationFile(filePath: string): Promise<Buffer | null> {
  return readGeneratedFile("pptx", filePath);
}

export async function deletePresentationFile(filePath: string): Promise<void> {
  return deleteGeneratedFile("pptx", filePath);
}

export function contentDispositionFor(title: string): string {
  return genericContentDisposition(title, "pptx");
}
