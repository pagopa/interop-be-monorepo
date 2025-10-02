import {
  EService,
  Descriptor,
  descriptorState,
  Attribute,
  AttributeId,
  Tenant,
  TenantId,
  EServiceId,
  PurposeId,
  Purpose,
  EServiceTemplate,
  EServiceTemplateVersion,
} from "pagopa-interop-models";

import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import {
  attributeNotFound,
  certifierTenantNotFound,
  descriptorPublishedNotFound,
  eserviceNotFound,
  purposeNotFound,
  tenantNotFound,
} from "../models/errors.js";

export async function retrieveTenant(
  tenantId: TenantId,
  readModelService: ReadModelServiceSQL
): Promise<Tenant> {
  const tenant = await readModelService.getTenantById(tenantId);
  if (!tenant) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
}

export function retrieveLatestPublishedDescriptor(
  eservice: EService
): Descriptor {
  const latestDescriptor = eservice.descriptors
    .filter((d) => d.state === descriptorState.published)
    .sort((a, b) => Number(a.version) - Number(b.version))
    .at(-1);
  if (!latestDescriptor) {
    throw descriptorPublishedNotFound(eservice.id);
  }
  return latestDescriptor;
}

export function retrieveLatestPublishedEServiceTemplateVersion(
  eserviceTemplate: EServiceTemplate
): EServiceTemplateVersion {
  const latestVersion = eserviceTemplate.versions
    .filter((d) => d.state === descriptorState.published)
    .sort((a, b) => Number(a.version) - Number(b.version))
    .at(-1);
  if (!latestVersion) {
    throw descriptorPublishedNotFound(eserviceTemplate.id);
  }
  return latestVersion;
}

export async function retrieveEservice(
  eserviceId: EServiceId,
  readModelService: ReadModelServiceSQL
): Promise<EService> {
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (!eservice) {
    throw eserviceNotFound(eserviceId);
  }
  return eservice;
}

export async function retrievePurpose(
  purposeId: PurposeId,
  readModelService: ReadModelServiceSQL
): Promise<Purpose> {
  const purpose = await readModelService.getPurposeById(purposeId);
  if (!purpose) {
    throw purposeNotFound(purposeId);
  }
  return purpose;
}

export async function retrieveAttribute(
  attributeId: AttributeId,
  readModelService: ReadModelServiceSQL
): Promise<Attribute> {
  const attribute = await readModelService.getAttributeById(attributeId);
  if (!attribute) {
    throw attributeNotFound(attributeId);
  }
  return attribute;
}

export async function retrieveTenantByCertifierId(
  certifierId: string,
  readModelService: ReadModelServiceSQL
): Promise<Tenant> {
  const tenant = await readModelService.getTenantByCertifierId(certifierId);
  if (!tenant) {
    throw certifierTenantNotFound(certifierId);
  }
  return tenant;
}
