import { fileURLToPath } from "url";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import {
  Agreement,
  Descriptor,
  descriptorState,
  EService,
  EServiceId,
  Tenant,
  TenantId,
} from "pagopa-interop-models";
import { dateAtRomeZone } from "pagopa-interop-commons";
import { EmailNotificationMessagePayload } from "pagopa-interop-models";
import {
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
  eserviceDescriptorPublishedMailTemplate: "eservice-descriptor-published-mail",
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
    address: event.address,
  });
}
