import { Tenant } from "pagopa-interop-models";
import { z } from "zod";

export const AnacReadModelTenant = Tenant.pick({
  id: true,
  externalId: true,
  attributes: true,
  features: true,
});

export type AnacReadModelTenant = z.infer<typeof AnacReadModelTenant>;
