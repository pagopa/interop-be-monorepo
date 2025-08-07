import {
  DPoPConfig,
  PecEmailManagerConfig,
  TokenGenerationReadModelDbConfig,
  EventsSignerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const PecEmailManagerConfigTest = PecEmailManagerConfig.and(
  z.object({
    mailpitAPIPort: z.number().optional(),
  })
);
export type PecEmailManagerConfigTest = z.infer<
  typeof PecEmailManagerConfigTest
>;

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

export const EnhancedEventsSignerConfig = EventsSignerConfig.and(
  z.object({ safeStoragePort: z.number() })
);
export type EnhancedEventsSignerConfig = z.infer<
  typeof EnhancedEventsSignerConfig
>;
