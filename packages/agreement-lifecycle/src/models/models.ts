import { Descriptor, Tenant } from "pagopa-interop-models";

export type DescriptorWithOnlyAttributes = Pick<Descriptor, "attributes">;
export type TenantWithOnlyAttributes = Pick<Tenant, "attributes">;
