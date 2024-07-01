import { certifiedAttributesSatisfied } from "pagopa-interop-commons";
import { toDescriptor, toTenant } from "./api/apiConverter.js";
import { CatalogProcessApiEServiceDescriptor } from "./api/catalogTypes.js";
import { TenantProcessApiTenant } from "./api/tenantTypes.js";

export const catalogProcessApiEServiceDescriptorCertifiedAttributesSatisfied = (
  descriptor: CatalogProcessApiEServiceDescriptor,
  tenant: TenantProcessApiTenant
): boolean =>
  certifiedAttributesSatisfied(toDescriptor(descriptor), toTenant(tenant));
