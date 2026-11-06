import { initFileManager, logger } from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import { makeDrizzleConnectionWithCleanup } from "pagopa-interop-readmodel";

import { config } from "./config/config.js";
import { documentsSignatureCheckerServiceBuilder } from "./services/documentsSignatureCheckerService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

const loggerInstance = logger({
  serviceName: "documents-signature-checker",
  correlationId: generateId<CorrelationId>(),
});

loggerInstance.info("Starting documents-signature-checker");

const fileManager = initFileManager(config);
const { cleanup, db: readModelDB } = makeDrizzleConnectionWithCleanup(config);

/**
 * Exit code: `0` when every document in the window was checked, `1` when the job
 * could not check part of them (S3 or readmodel failures, the run has to be
 * repeated), `255` when the run itself failed. Non conforming documents do not
 * fail the run: they are reported as `ERROR` log lines for monitoring to catch.
 *
 * `process.exitCode` is assigned instead of calling `process.exit` so that the
 * log output is fully flushed before the process terminates.
 */
try {
  const documentsSignatureCheckerService =
    documentsSignatureCheckerServiceBuilder({
      readModelService: readModelServiceBuilderSQL(readModelDB),
      fileManager,
      logger: loggerInstance,
      unsignedBucket: config.s3Bucket,
      signedBucket: config.s3BucketSigned,
      documentsLookBackDays: config.documentsLookBackDays,
      documentsBatchSize: config.documentsBatchSize,
      signingGracePeriodMinutes: config.signingGracePeriodMinutes,
    });

  const report = await documentsSignatureCheckerService.verify();

  process.exitCode = report.notCheckedCount > 0 ? 1 : 0;
} catch (error) {
  loggerInstance.error(`Error running documents-signature-checker: ${error}`);
  process.exitCode = 255;
} finally {
  await cleanup();
}
