import { certifiedAttributesSatisfied } from "pagopa-interop-agreement-lifecycle";
import { catalogApi, tenantApi } from "pagopa-interop-api-clients";
import { toDescriptorWithOnlyAttributes } from "./api/converters/catalogClientApiConverter.js";
import { toTenantWithOnlyAttributes } from "./api/converters/tenantClientApiConverters.js";

export const catalogProcessApiEServiceDescriptorCertifiedAttributesSatisfied = (
  descriptor: catalogApi.EServiceDescriptor,
  tenant: tenantApi.Tenant
): boolean =>
  certifiedAttributesSatisfied(
    toDescriptorWithOnlyAttributes(descriptor),
    toTenantWithOnlyAttributes(tenant)
  );
