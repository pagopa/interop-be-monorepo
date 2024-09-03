import { PecEmailManagerConfig } from "pagopa-interop-commons";
import { z } from "zod";

export const PecEmailManagerConfigTest = PecEmailManagerConfig.and(
  z.object({
    mailpitAPIPort: z.number().optional(),
  })
);
export type PecEmailManagerConfigTest = z.infer<
  typeof PecEmailManagerConfigTest
>;
