import { z } from "zod";
import {
  TenantId,
} from "../brandedIds.js";
import { TenantKind } from "../tenant/tenant.js";

export const TenantKindHistory = z.object({
  tenantId: TenantId,
  version: z.number(),
  kind: TenantKind,
  modifiedAt: z.date(),
});

export type TenantKindHistory = z.infer<typeof TenantKindHistory>;
