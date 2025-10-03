/* eslint-disable max-params */
import { Readable } from "stream";
import { invalidDocumentDetected } from "pagopa-interop-models";
import { FileManager } from "../file-manager/fileManager.js";
import { Logger } from "../logging/index.js";
import { calculateChecksum } from "../utils/fileUtils.js";

/*  Validates document as PDF and stores it with FileManager,
  its logic is the same in eserviceDocumentUtils.ts */
export async function validateAndStorePDFDocument<T>(
  fileManager: FileManager,
  resourceId: string,
  doc: File,
  documentId: string,
  documentContainer: string,
  documentPath: string,
  prettyName: string,
  createDocumentHandler: (
    documentId: string,
    fileName: string,
    filePath: string,
    prettyName: string,
    contentType: string,
    checksum: string
  ) => Promise<T>,
  logger: Logger
): Promise<T> {
  if (doc.type !== "application/pdf") {
    throw invalidDocumentDetected(resourceId);
  }
  const filePath = await fileManager.storeBytes(
    {
      bucket: documentContainer,
      path: documentPath,
      resourceId: documentId,
      name: doc.name,
      content: Buffer.from(await doc.arrayBuffer()),
    },
    logger
  );
  const checksum = await calculateChecksum(Readable.from(doc.stream()));

  try {
    return await createDocumentHandler(
      documentId,
      doc.name,
      filePath,
      prettyName,
      doc.type,
      checksum
    );
  } catch (error) {
    await fileManager.delete(documentContainer, filePath, logger);
    throw error;
  }
}
