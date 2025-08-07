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
import {
  agreementStampDateNotFound,
  descriptorNotFound,
  descriptorPublishedNotFound,
  eServiceNotFound,
  htmlTemplateNotFound,
  tenantNotFound,
} from "../models/errors.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

// Be careful to change this enum, it's used to find the html template files
export const eventMailTemplateType = {
  agreementActivatedMailTemplate: "agreement-activated-mail",
  // agreementSubmittedMailTemplate: "agreement-submitted-mail",
  // agreementRejectedMailTemplate: "agreement-rejected-mail",
  // newPurposeVersionWaitingForApprovalMailTemplate:
  //   "new-purpose-version-waiting-for-approval-mail",
  // firstPurposeVersionRejectedMailTemplate:
  //   "first-purpose-version-rejected-mail",
  // otherPurposeVersionRejectedMailTemplate:
  //   "other-purpose-version-rejected-mail",
  // purposeWaitingForApprovalMailTemplate: "purpose-waiting-for-approval-mail",
  eserviceDescriptorPublishedMailTemplate: "eservice-descriptor-published-mail",
  // purposeVersionActivatedMailTemplate: "purpose-version-activated-mail",
} as const;

const EventMailTemplateType = z.enum([
  Object.values(eventMailTemplateType)[0],
  ...Object.values(eventMailTemplateType).slice(1),
]);

export type EventMailTemplateType = z.infer<typeof EventMailTemplateType>;

export async function retrieveAgreementEservice(
  agreement: Agreement,
  readModelService: ReadModelServiceSQL
): Promise<EService> {
  const eservice = await readModelService.getEServiceById(agreement.eserviceId);

  if (!eservice) {
    throw eServiceNotFound(agreement.eserviceId);
  }

  return eservice;
}

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
