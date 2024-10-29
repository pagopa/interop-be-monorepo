import {
  PurposeVersion as ReadModelPurposeVersion,
  Purpose as ReadModelPurpose,
  ExternalId,
} from "pagopa-interop-models";
import { z } from "zod";

export const PurposeVersion = ReadModelPurposeVersion.pick({
  firstActivationAt: true,
  state: true,
  dailyCalls: true,
});

export const Purpose = ReadModelPurpose.pick({
  id: true,
  consumerId: true,
}).merge(
  z.object({
    versions: z.array(PurposeVersion),
    consumerName: z.string(),
    consumerExternalId: ExternalId,
  })
);

export type PurposeVersion = z.infer<typeof PurposeVersion>;
export type Purpose = z.infer<typeof Purpose>;
