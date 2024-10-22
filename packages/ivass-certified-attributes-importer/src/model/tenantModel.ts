import { Tenant } from "pagopa-interop-models";
import { z } from "zod";

export const PersistentTenant = Tenant.pick({
  id: true,
  externalId: true,
  attributes: true,
  features: true,
});

export type PersistentTenant = z.infer<typeof PersistentTenant>;
