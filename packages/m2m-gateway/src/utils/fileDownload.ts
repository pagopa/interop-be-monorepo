import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  agreementApi,
  catalogApi,
  purposeApi,
} from "pagopa-interop-api-clients";
import { FileManager, Logger } from "pagopa-interop-commons";
import { Response } from "express";
import { FormDataEncoder } from "form-data-encoder";

export async function downloadDocument(
  document:
    | catalogApi.EServiceDoc
    | agreementApi.Document
    | (purposeApi.PurposeVersionDocument & { name: string }),
  fileManager: FileManager,
  bucket: string,
  logger: Logger
): Promise<File> {
  const fileContent = await fileManager.get(bucket, document.path, logger);
  return new File([fileContent], document.name, {
    type: document.contentType,
  });
}

export async function sendFileAsFormData(
  file: File,
  res: Response
): Promise<Response> {
  const form = new FormData();
  form.set("file", file);
  form.set("filename", file.name);
  form.set("contentType", file.type);

  const encoder = new FormDataEncoder(form);

  res.writeHead(200, encoder.headers);

  // Stream the multipart body and end the response when done
  await pipeline(Readable.from(encoder.encode()), res);
  return res;
}
