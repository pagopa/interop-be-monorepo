import { Tenant } from "pagopa-interop-models";
import { z } from "zod";

export type JobStats = {
  processed: number;
  created: number;
  updated: number;
  revoked: number;
  skipped: number;
  errors: number;
};

export const IstatReadModelTenant = Tenant.pick({
  id: true,
  externalId: true,
  attributes: true,
  features: true,
});

export type IstatReadModelTenant = z.infer<typeof IstatReadModelTenant>;
