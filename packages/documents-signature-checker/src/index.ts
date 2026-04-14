import { initFileManager, logger } from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import { makeDrizzleConnectionWithCleanup } from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { documentsSignatureCheckerServiceBuilder } from "./services/documentsSignatureCheckerService.js";

const loggerInstance = logger({
  serviceName: "documents-signature-checker",
  correlationId: generateId<CorrelationId>(),
});

loggerInstance.info("Starting documents-signature-checker");

const fileManager = initFileManager(config);
const { cleanup, db: readModelDB } = makeDrizzleConnectionWithCleanup(config);

try {
  const documentsSignatureCheckerService =
    documentsSignatureCheckerServiceBuilder(
      readModelDB,
      fileManager,
      loggerInstance,
      config.documentsLookBackDays,
      config.s3Bucket,
      config.s3BucketSigned
    );

  await documentsSignatureCheckerService.verify();
} catch (error: unknown) {
  loggerInstance.error(error);
} finally {
  await cleanup();
}
