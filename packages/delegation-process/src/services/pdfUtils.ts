import path from "path";
import { fileURLToPath } from "url";
import { FileManager, Logger, PDFGenerator } from "pagopa-interop-commons";
import { Delegation } from "pagopa-interop-models";
import { config } from "../config/config.js";

export const createPdfDelegation = async (
  delegation: Delegation,
  pdfGenerator: PDFGenerator,
  fileManager: FileManager,
  logger: Logger
): Promise<void> => {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  const templateFilePath = path.resolve(
    dirname,
    "..",
    "resources/templates",
    "delegationApproved.html"
  );
  const pdfBuffer = await pdfGenerator.generate(templateFilePath, {});

  const documentPath = await fileManager.storeBytes(
    {
      bucket: config.delegationDocumentBucket,
      path: config.delegationDocumentPath,
      name: delegation.id,
      content: pdfBuffer,
    },
    logger
  );
  logger.info(`Stored delegation document at ${documentPath}`);
};
