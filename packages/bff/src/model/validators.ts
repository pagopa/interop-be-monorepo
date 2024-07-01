import { certifiedAttributesSatisfied } from "pagopa-interop-lifecycle";
import { CatalogProcessApiEServiceDescriptor } from "./api/catalogTypes.js";
import { TenantProcessApiTenant } from "./api/tenantTypes.js";
import {
  toDescriptorWithOnlyAttributes,
  toTenantWithOnlyAttributes,
} from "./api/converters/catalogClientApiConverter.js";

export const catalogProcessApiEServiceDescriptorCertifiedAttributesSatisfied = (
  descriptor: CatalogProcessApiEServiceDescriptor,
  tenant: TenantProcessApiTenant
): boolean =>
  certifiedAttributesSatisfied(
    toDescriptorWithOnlyAttributes(descriptor),
    toTenantWithOnlyAttributes(tenant)
  );
