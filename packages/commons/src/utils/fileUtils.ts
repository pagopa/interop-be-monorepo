import crypto from "crypto";
import { isText } from "istextorbinary";
import { Readable } from "stream";
import { match } from "ts-pattern";
import { z } from "zod";

export async function calculateChecksum(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");

    stream.on("data", (data) => {
      hash.update(data);
    });

    stream.on("end", () => {
      resolve(hash.digest("hex"));
    });

    stream.on("error", (err) => {
      reject(err);
    });
  });
}

export function getExtensionFromFile(file: File): string {
  const name = file.name || "";
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx + 1).toLowerCase();
}

export const uploadAllowedFileExtensions = {
  pdf: "pdf",
  json: "json",
  md: "md",
  yaml: "yaml",
  yml: "yml",
  txt: "txt",
  xsd: "xsd",
  wsdl: "wsdl",
  xml: "xml",
} as const;

export const UploadAllowedFileExtensions = z.enum([
  Object.values(uploadAllowedFileExtensions)[0],
  ...Object.values(uploadAllowedFileExtensions).slice(1),
]);
export type UploadAllowedFileExtensionsType = z.infer<
  typeof UploadAllowedFileExtensions
>;

export function fileHasAllowedExtensions(
  file: File,
  allowedExtensions: string[] = Object.values(uploadAllowedFileExtensions)
) {
  return allowedExtensions
    .map((ext) => ext.toLowerCase())
    .includes(getExtensionFromFile(file));
}

async function readSlice(file: File, start: number, end: number) {
  return new Uint8Array(await file.slice(start, end).arrayBuffer());
}
async function readText(file: File, start = 0, end?: number) {
  return await file.slice(start, end ?? file.size).text();
}

export async function looksLikeText(file: File) {
  const ab = await file.arrayBuffer();
  const buffer = Buffer.from(ab);
  return !!isText(file.name || "", buffer);
}

export async function isPdf(doc: File) {
  const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d];
  if (doc.size < PDF_MAGIC_BYTES.length) return false;
  if (!doc.name?.toLowerCase().endsWith(".pdf")) return false;

  // Check if pdf header is present in the first 1024 bytes
  const header = await readSlice(doc, 0, 1024);
  for (let i = 0; i <= header.length - PDF_MAGIC_BYTES.length; ++i) {
    const headerWindow = header.slice(i, i + PDF_MAGIC_BYTES.length);

    let failure = false;
    for (const [k, byte] of headerWindow.entries()) {
      if (PDF_MAGIC_BYTES[k] !== byte) failure = true;
    }

    if (!failure) return true;
  }

  return false;
}

export async function isJson(file: File) {
  const txt = await readText(file);
  try {
    JSON.parse(txt);
    return true;
  } catch {
    return false;
  }
}

export async function isValidFile(file: File) {
  if (!fileHasAllowedExtensions(file)) return false;

  const ext = getExtensionFromFile(file) as UploadAllowedFileExtensionsType;

  return match(ext)
    .returnType<Promise<boolean>>()
    .with("json", () => isJson(file))
    .with("pdf", () => isPdf(file))
    .otherwise(() => looksLikeText(file));
}
