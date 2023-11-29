import { match } from "ts-pattern";
import {
  TenantCreatedV1,
  TenantUpdatedV1,
  TenantDeletedV1,
  SelfcareMappingCreatedV1,
  SelfcareMappingDeletedV1,
} from "../gen/v1/tenant/events.js";

export function tenantEventToBinaryData(event: TenantEvent): Uint8Array {
  return match(event)
    .with({ type: "TenantCreated" }, ({ data }) =>
      TenantCreatedV1.toBinary(data)
    )
    .with({ type: "TenantUpdated" }, ({ data }) =>
      TenantUpdatedV1.toBinary(data)
    )
    .with({ type: "TenantDeleted" }, ({ data }) =>
      TenantDeletedV1.toBinary(data)
    )
    .with({ type: "SelfcareMappingCreated" }, ({ data }) =>
      SelfcareMappingCreatedV1.toBinary(data)
    )
    .with({ type: "SelfcareMappingDeleted" }, ({ data }) =>
      SelfcareMappingDeletedV1.toBinary(data)
    )
    .exhaustive();
}

export type TenantEvent =
  | { type: "TenantCreated"; data: TenantCreatedV1 }
  | { type: "TenantUpdated"; data: TenantUpdatedV1 }
  | { type: "TenantDeleted"; data: TenantDeletedV1 }
  | { type: "SelfcareMappingCreated"; data: SelfcareMappingCreatedV1 }
  | { type: "SelfcareMappingDeleted"; data: SelfcareMappingDeletedV1 };
