import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import {
  buildIntegrityRest02SignedHeaders,
  FileManager,
  Logger,
} from "pagopa-interop-commons";
import { Response } from "express";
import { FormDataEncoder } from "form-data-encoder";
import { getIntoropTokenGenerator } from "./tokenGenerator.js";

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
  res: Response,
  clientId: string
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

  const hash = createHash("sha256");

  for await (const chunk of encoder.encode()) {
    hash.update(chunk);
  }
  const digest = hash.digest("base64");
  const contentType = encoder.headers["Content-Type"];
  const contentEncoding = res.getHeader("Content-Encoding")?.toString();

  const tokenGenerator = getIntoropTokenGenerator();
  const agidSignature = await tokenGenerator.generateAgidIntegrityRest02Token({
    signedHeaders: buildIntegrityRest02SignedHeaders({
      digest,
      contentType,
      contentEncoding,
    }),
    aud: clientId,
    sub: res.getHeader("x-correlation-id") as string,
  });

  res.setHeader("Digest", `SHA-256=${digest}`);
  res.setHeader("Agid-JWT-Signature", agidSignature);
  res.writeHead(200, encoder.headers);

  // Stream the multipart body and end the response when done
  await pipeline(Readable.from(encoder.encode()), res);

  return res;
}
