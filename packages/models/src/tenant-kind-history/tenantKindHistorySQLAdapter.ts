import { unsafeBrandId } from "../brandedIds.js";
import { TenantKind } from "../tenant/tenant.js";
import {
  TenantKindHistory,
} from "./tenantKindHistory.js";

export type TenantKindHistorySQL = {
  tenantId: string;
  metadataVersion: number;
  kind: string;
  modifiedAt: string;
};

export const fromTenantKindHistorySQL = (
  tenantKindHistory: TenantKindHistorySQL
): TenantKindHistory => ({
  tenantId: unsafeBrandId(tenantKindHistory.tenantId),
  version: tenantKindHistory.metadataVersion,
  kind: TenantKind.parse(tenantKindHistory.kind),
  modifiedAt: new Date(tenantKindHistory.modifiedAt),
});
