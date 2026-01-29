import {
  ReadModelSQLDbConfig,
  SelfCareClientConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const CheckDiffConfig = SelfCareClientConfig.and(ReadModelSQLDbConfig).and(
  z
    .object({
      INTEROP_PRODUCT: z.string(),
    })
    .transform((c) => ({
      interopProduct: c.INTEROP_PRODUCT,
    }))
);

export type CheckDiffConfig = z.infer<typeof CheckDiffConfig>;

export const config: CheckDiffConfig = CheckDiffConfig.parse(process.env);
