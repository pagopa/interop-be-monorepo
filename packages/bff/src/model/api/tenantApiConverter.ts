import { tenantApi, bffApi } from "pagopa-interop-api-clients";

export const toBffApiCompactOrganization = (
  input: tenantApi.Tenant
): bffApi.CompactOrganization => ({
  id: input.id,
  name: input.name,
});

export const toBffApiRequesterCertifiedAttributes = (
  input: tenantApi.CertifiedAttribute
): bffApi.RequesterCertifiedAttribute => ({
  tenantId: input.id,
  tenantName: input.name,
  attributeId: input.attributeId,
  attributeName: input.attributeName,
});
