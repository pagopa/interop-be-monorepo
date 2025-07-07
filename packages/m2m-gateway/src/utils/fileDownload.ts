import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { FileManager, Logger } from "pagopa-interop-commons";
import { Response } from "express";
import { FormDataEncoder } from "form-data-encoder";

export type DownloadedDocument = {
  id: string;
  file: File;
  prettyName: string | undefined;
};

type DocumentData = {
  path: string;
  id: string;
  contentType: string;
  name: string;
  prettyName?: string;
};
export async function downloadDocument(
  { id, path, contentType, name, prettyName }: DocumentData,
  fileManager: FileManager,
  bucket: string,
  logger: Logger
): Promise<DownloadedDocument> {
  const fileContent = await fileManager.get(bucket, path, logger);
  const file = new File([fileContent], name, {
    type: contentType,
  });
  return {
    id,
    file,
    prettyName,
  };
}

export async function sendDownloadedDocumentAsFormData(
  { id, file, prettyName }: DownloadedDocument,
  res: Response
): Promise<Response> {
  const form = new FormData();
  form.set("file", file);
  form.set("filename", file.name);
  form.set("contentType", file.type);
  form.set("id", id);

  if (prettyName) {
    form.set("prettyName", prettyName);
  }

  const encoder = new FormDataEncoder(form);

  res.writeHead(200, encoder.headers);

  // Stream the multipart body and end the response when done
  await pipeline(Readable.from(encoder.encode()), res);
  return res;
}
