import { Tenant } from "pagopa-interop-models";
import { z } from "zod";

export const IvassReadModelTenant = Tenant.pick({
  id: true,
  externalId: true,
  attributes: true,
  features: true,
});

export type IvassReadModelTenant = z.infer<typeof IvassReadModelTenant>;
