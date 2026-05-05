import {
  ReadModelSQLDbConfig,
  SelfCareClientConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const CheckDiffConfig = SelfCareClientConfig.and(ReadModelSQLDbConfig).and(
  z
    .object({
      INTEROP_PRODUCT: z.string(),
      SELFCARE_API_CONCURRENCY: z.coerce.number().default(5),
    })
    .transform((c) => ({
      interopProduct: c.INTEROP_PRODUCT,
      selfcareApiConcurrency: c.SELFCARE_API_CONCURRENCY,
    }))
);

export type CheckDiffConfig = z.infer<typeof CheckDiffConfig>;

export const config: CheckDiffConfig = CheckDiffConfig.parse(process.env);
