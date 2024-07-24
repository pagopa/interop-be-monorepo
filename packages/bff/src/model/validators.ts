import { certifiedAttributesSatisfied } from "pagopa-interop-agreement-lifecycle";
import { catalogApi, tenantApi } from "pagopa-interop-api-clients";
import {
  toDescriptorWithOnlyAttributes,
  toTenantWithOnlyAttributes,
} from "./api/apiConverter.js";

export const catalogProcessApiEServiceDescriptorCertifiedAttributesSatisfied = (
  descriptor: catalogApi.EServiceDescriptor,
  tenant: tenantApi.Tenant
): boolean =>
  certifiedAttributesSatisfied(
    toDescriptorWithOnlyAttributes(descriptor),
    toTenantWithOnlyAttributes(tenant)
  );
