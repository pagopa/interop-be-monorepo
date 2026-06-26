import {
  Agreement,
  Attribute,
  AttributeId,
  Delegation,
  Descriptor,
  DescriptorId,
  descriptorState,
  EService,
  EServiceId,
  Purpose,
  PurposeId,
  Tenant,
  TenantId,
} from "pagopa-interop-models";
import {
  activeProducerDelegationNotFound,
  attributeNotFound,
  certifierTenantNotFound,
  descriptorNotFound,
  eserviceNotFound,
  eserviceWithoutDescriptors,
  purposeNotFound,
  tenantNotFound,
} from "./models/errors.js";
import { NotificationReadModelService } from "./types.js";

export async function retrieveTenant(
  tenantId: TenantId,
  readModelService: NotificationReadModelService
): Promise<Tenant> {
  const tenant = await readModelService.getTenantById(tenantId);
  if (!tenant) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
}

export async function retrieveEservice(
  eserviceId: EServiceId,
  readModelService: NotificationReadModelService
): Promise<EService> {
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (!eservice) {
    throw eserviceNotFound(eserviceId);
  }
  return eservice;
}

export async function retrieveAgreementEservice(
  agreement: Agreement,
  readModelService: NotificationReadModelService
): Promise<EService> {
  return await retrieveEservice(agreement.eserviceId, readModelService);
}

export async function retrievePurpose(
  purposeId: PurposeId,
  readModelService: NotificationReadModelService
): Promise<Purpose> {
  const purpose = await readModelService.getPurposeById(purposeId);
  if (!purpose) {
    throw purposeNotFound(purposeId);
  }
  return purpose;
}

export async function retrieveAttribute(
  attributeId: AttributeId,
  readModelService: NotificationReadModelService
): Promise<Attribute> {
  const attribute = await readModelService.getAttributeById(attributeId);
  if (!attribute) {
    throw attributeNotFound(attributeId);
  }
  return attribute;
}

export async function retrieveTenantByCertifierId(
  certifierId: string,
  readModelService: NotificationReadModelService
): Promise<Tenant> {
  const tenant = await readModelService.getTenantByCertifierId(certifierId);
  if (!tenant) {
    throw certifierTenantNotFound(certifierId);
  }
  return tenant;
}

export async function retrieveProducerDelegation(
  eservice: EService,
  readModelService: NotificationReadModelService
): Promise<Delegation> {
  const delegation = await readModelService.getActiveProducerDelegation(
    eservice.id,
    eservice.producerId
  );
  if (!delegation) {
    throw activeProducerDelegationNotFound(eservice.id);
  }
  return delegation;
}

export function retrieveLatestDescriptor(eservice: EService): Descriptor {
  if (eservice.descriptors.length === 0) {
    throw eserviceWithoutDescriptors(eservice.id);
  }

  const publishedDescriptor = eservice.descriptors.find(
    (d) => d.state === descriptorState.published
  );

  if (publishedDescriptor) {
    return publishedDescriptor;
  }

  const latestNotDraftDescriptor = eservice.descriptors
    .filter((d) => d.state !== descriptorState.draft)
    .sort((a, b) => Number(a.version) - Number(b.version))
    .at(-1);
  if (latestNotDraftDescriptor) {
    return latestNotDraftDescriptor;
  }

  return eservice.descriptors[0];
}

export function retrieveDescriptor(
  eservice: EService,
  descriptorId: DescriptorId
): Descriptor {
  const descriptor = eservice.descriptors.find((d) => d.id === descriptorId);
  if (!descriptor) {
    throw descriptorNotFound(eservice.id, descriptorId);
  }
  return descriptor;
}
