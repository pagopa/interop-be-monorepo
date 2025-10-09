import { fileURLToPath } from "url";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import {
  Agreement,
  Delegation,
  Descriptor,
  descriptorState,
  EService,
  EServiceId,
  Tenant,
  TenantId,
} from "pagopa-interop-models";
import { dateAtRomeZone } from "pagopa-interop-commons";
import { EmailNotificationMessagePayload } from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  activeProducerDelegationNotFound,
  agreementStampDateNotFound,
  descriptorNotFound,
  descriptorPublishedNotFound,
  eServiceNotFound,
  htmlTemplateNotFound,
  tenantNotFound,
} from "../models/errors.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

export const eventMailTemplateType = {
  agreementActivatedToConsumerMailTemplate:
    "agreement-activated-to-consumer-mail",
  agreementActivatedToProducerMailTemplate:
    "agreement-activated-to-producer-mail",
  agreementSubmittedMailTemplate: "agreement-submitted-mail",
  agreementRejectedMailTemplate: "agreement-rejected-mail",
  agreementUpgradedMailTemplate: "agreement-upgraded-mail",
  eserviceDescriptorSuspendedMailTemplate: "eservice-descriptor-suspended-mail",
  eserviceDescriptorActivatedMailTemplate: "eservice-descriptor-activated-mail",
  eserviceDescriptorPublishedMailTemplate: "eservice-descriptor-published-mail",
  producerKeychainEserviceAddedMailTemplate:
    "producer-keychain-eservice-added-mail",
  agreementSuspendedByConsumerMailTemplate:
    "agreement-suspended-by-consumer-mail",
  agreementSuspendedByPlatformToProducerMailTemplate:
    "agreement-suspended-by-platform-to-producer-mail",
  agreementUnsuspendedByConsumerMailTemplate:
    "agreement-unsuspended-by-consumer-mail",
  agreementUnsuspendedByPlatformToProducerMailTemplate:
    "agreement-unsuspended-by-platform-to-producer-mail",
  agreementSuspendedByPlatformToConsumerMailTemplate:
    "agreement-suspended-by-platform-to-consumer-mail",
  agreementUnsuspendedByPlatformToConsumerMailTemplate:
    "agreement-unsuspended-by-platform-to-consumer-mail",
  agreementSuspendedByProducerMailTemplate:
    "agreement-suspended-by-producer-mail",
  agreementUnsuspendedByProducerMailTemplate:
    "agreement-unsuspended-by-producer-mail",
  agreementArchivedByConsumerMailTemplate:
    "agreement-archived-by-consumer-mail",
  clientPurposeAddedMailTemplate: "client-purpose-added-mail",
  clientPurposeRemovedMailTemplate: "client-purpose-removed-mail",
  purposeVersionSuspendedByConsumerMailTemplate:
    "purpose-version-suspended-by-consumer-mail",
  purposeVersionUnsuspendedByConsumerMailTemplate:
    "purpose-version-unsuspended-by-consumer-mail",
  purposeArchivedMailTemplate: "purpose-archived-mail",
  purposeVersionActivatedMailTemplate: "purpose-version-activated-mail",
  purposeVersionRejectedMailTemplate: "purpose-version-rejected-mail",
  purposeVersionSuspendedByProducerMailTemplate:
    "purpose-version-suspended-by-producer-mail",
  purposeVersionUnsuspendedByProducerMailTemplate:
    "purpose-version-unsuspended-by-producer-mail",
  newPurposeVersionWaitingForApprovalMailTemplate:
    "new-purpose-version-waiting-for-approval-mail",
  consumerDelegationApprovedMailTemplate: "consumer-delegation-approved-mail",
  consumerDelegationRejectedMailTemplate: "consumer-delegation-rejected-mail",
  consumerDelegationRevokedMailTemplate: "consumer-delegation-revoked-mail",
  consumerDelegationSubmittedMailTemplate: "consumer-delegation-submitted-mail",
  eserviceDescriptorApprovedByDelegatorMailTemplate:
    "eservice-descriptor-approved-by-delegator-mail",
  eserviceDescriptorRejectedByDelegatorMailTemplate:
    "eservice-descriptor-rejected-by-delegator-mail",
  eserviceDescriptorSubmittedByDelegateMailTemplate:
    "eservice-descriptor-submitted-by-delegate-mail",
  eserviceStateChangedMailTemplate: "eservice-state-changed-mail",
  producerDelegationApprovedMailTemplate: "producer-delegation-approved-mail",
  producerDelegationRejectedMailTemplate: "producer-delegation-rejected-mail",
  producerDelegationRevokedMailTemplate: "producer-delegation-revoked-mail",
  producerDelegationSubmittedMailTemplate: "producer-delegation-submitted-mail",
  tenantCertifiedAttributeAssignedMailTemplate:
    "tenant-certified-attribute-assigned-mail",
  tenantCertifiedAttributeRevokedMailTemplate:
    "tenant-certified-attribute-revoked-mail",
  tenantVerifiedAttributeAssignedMailTemplate:
    "tenant-verified-attribute-assigned-mail",
  tenantVerifiedAttributeRevokedMailTemplate:
    "tenant-verified-attribute-revoked-mail",
} as const;

const EventMailTemplateType = z.enum([
  Object.values(eventMailTemplateType)[0],
  ...Object.values(eventMailTemplateType).slice(1),
]);

export type EventMailTemplateType = z.infer<typeof EventMailTemplateType>;

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

export function retrieveAgreementDescriptor(
  eservice: EService,
  agreement: Agreement
): Descriptor {
  const descriptor = eservice.descriptors.find(
    (d) => d.id === agreement.descriptorId
  );

  if (!descriptor) {
    throw descriptorNotFound(agreement.eserviceId, agreement.descriptorId);
  }
  return descriptor;
}

export const retrieveEService = async (
  eserviceId: EServiceId,
  readModelService: ReadModelServiceSQL
): Promise<EService> => {
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (!eservice) {
    throw eServiceNotFound(eserviceId);
  }
  return eservice;
};

export async function retrieveProducerDelegation(
  eservice: EService,
  readModelService: ReadModelServiceSQL
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

export async function retrieveHTMLTemplate(
  templateKind: EventMailTemplateType
): Promise<string> {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  const templatePath = `/resources/templates/${templateKind}.html`;

  try {
    const htmlTemplateBuffer = await fs.readFile(
      `${dirname}/..${templatePath}`
    );
    return htmlTemplateBuffer.toString();
  } catch {
    throw htmlTemplateNotFound(templatePath);
  }
}

export function getFormattedAgreementStampDate(
  agreement: Agreement,
  stamp: keyof Agreement["stamps"]
): string {
  const stampDate = agreement.stamps[stamp]?.when;

  if (stampDate === undefined) {
    throw agreementStampDateNotFound(stamp, agreement.id);
  }
  return dateAtRomeZone(new Date(Number(stampDate)));
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

export function encodeEmailEvent(
  event: EmailNotificationMessagePayload
): string {
  return JSON.stringify({
    correlationId: event.correlationId,
    email: {
      subject: event.email.subject,
      body: event.email.body,
    },
    tenantId: event.tenantId,
    ...match(event)
      .with({ type: "User" }, ({ type, userId }) => ({ type, userId }))
      .with({ type: "Tenant" }, ({ type, address }) => ({ type, address }))
      .exhaustive(),
  });
}
