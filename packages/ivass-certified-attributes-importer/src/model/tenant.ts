import { Tenant } from "pagopa-interop-models";
import { z } from "zod";

export const IvassCompactTenant = Tenant.pick({
  id: true,
  externalId: true,
  attributes: true,
  features: true,
});

export type IvassCompactTenant = z.infer<typeof IvassCompactTenant>;
