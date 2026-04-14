import {
  FileManagerConfig,
  LoggerConfig,
  ReadModelSQLDbConfig,
  S3Config,
} from "pagopa-interop-commons";
import { z } from "zod";

const PDFSignatureCheckerConfig = LoggerConfig.and(ReadModelSQLDbConfig)
  .and(FileManagerConfig)
  .and(S3Config)
  .and(
    z
      .object({
        S3_BUCKET_SIGNED_DOCUMENTS: z.string(),
        DOCUMENTS_LOOK_BACK_DAYS: z.coerce.number().int().positive().default(1),
        DOCUMENTS_BATCH_SIZE: z.coerce.number().int().positive().default(50),
      })
      .transform((c) => ({
        s3BucketSigned: c.S3_BUCKET_SIGNED_DOCUMENTS,
        documentsLookBackDays: c.DOCUMENTS_LOOK_BACK_DAYS,
        documentsBatchSize: c.DOCUMENTS_BATCH_SIZE,
      }))
  );

type PDFSignatureCheckerConfig = z.infer<typeof PDFSignatureCheckerConfig>;

export const config: PDFSignatureCheckerConfig =
  PDFSignatureCheckerConfig.parse(process.env);
