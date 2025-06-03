import {
  DPoPConfig,
  TokenGenerationReadModelDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const EnhancedTokenGenerationReadModelDbConfig =
  TokenGenerationReadModelDbConfig.and(
    z.object({ tokenGenerationReadModelDbPort: z.number() })
  );
export type EnhancedTokenGenerationReadModelDbConfig = z.infer<
  typeof EnhancedTokenGenerationReadModelDbConfig
>;

export const EnhancedDPoPConfig = DPoPConfig.and(
  z.object({ dpopDbPort: z.number() })
);
export type EnhancedDPoPConfig = z.infer<typeof EnhancedDPoPConfig>;
