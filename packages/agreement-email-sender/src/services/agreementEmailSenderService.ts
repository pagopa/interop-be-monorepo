import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import {
  AgreementV2,
  Tenant,
  TenantMail,
  fromAgreementV2,
  tenantMailKind,
} from "pagopa-interop-models";
import {
  EmailManager,
  buildHTMLTemplateService,
  dateAtRomeZone,
} from "pagopa-interop-commons";
import {
  activationDateNotFound,
  descriptorNotFound,
  eServiceNotFound,
  tenantDigitalAddressNotFound,
  tenantNotFound,
} from "../models/errors.js";
import { config } from "../utilities/config.js";
import { ReadModelService } from "./readModelService.js";

export const retrieveTenantDigitalAddress = (tenant: Tenant): TenantMail => {
  const digitalAddress = tenant.mails.find(
    (m) => m.kind === tenantMailKind.DigitalAddress
  );
  if (!digitalAddress) {
    throw tenantDigitalAddressNotFound(tenant.id);
  }
  return digitalAddress;
};

async function getActivationMailFromAgreement(
  agreementV2: AgreementV2,
  readModelService: ReadModelService
): Promise<{
  subject: string;
  body: string;
  to: string[];
}> {
  const agreement = fromAgreementV2(agreementV2);
  const templateService = buildHTMLTemplateService();
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);

  const { getEServiceById, getTenantById } = readModelService;

  const htmlTemplateBuffer = await fs.readFile(
    `${dirname}/../resources/templates/activation-mail.html`
  );
  const htmlTemplate = htmlTemplateBuffer.toString();

  const activationDate = agreement.stamps.activation?.when;

  if (activationDate === undefined) {
    throw activationDateNotFound(agreement.id);
  }
  const formattedActivationDate = dateAtRomeZone(
    new Date(Number(activationDate))
  );

  const [eservice, producer, consumer] = await Promise.all([
    getEServiceById(agreement.eserviceId),
    getTenantById(agreement.producerId),
    getTenantById(agreement.consumerId),
  ]);

  if (!eservice) {
    throw eServiceNotFound(agreement.eserviceId);
  }

  if (!producer) {
    throw tenantNotFound(agreement.producerId);
  }

  if (!consumer) {
    throw tenantNotFound(agreement.consumerId);
  }

  /* No need to call selfcare API anymore.
  We now have the producer and consumer digital addresses in their respective tenant object,
  kept up to date through a queue.
  We only expect one digital address per tenant, so we can safely use the first one we find. */
  const producerEmail = retrieveTenantDigitalAddress(producer).address;
  const consumerEmail = retrieveTenantDigitalAddress(consumer).address;

  const descriptor = eservice.descriptors.find(
    (d) => d.id === agreement.descriptorId
  );

  if (!descriptor) {
    throw descriptorNotFound(agreement.eserviceId, agreement.descriptorId);
  }

  return {
    subject: `Richiesta di fruizione ${agreement.id} attiva`,
    to: [producerEmail, consumerEmail],
    body: templateService.compileHtml(htmlTemplate, {
      activationDate: formattedActivationDate,
      agreementId: agreement.id,
      eserviceName: eservice.name,
      eserviceVersion: descriptor.version,
      producerName: producer.name,
      consumerName: consumer.name,
    }),
  };
}

// eslint-disable-next-line max-params
export async function sendAgreementEmail(
  agreement: AgreementV2,
  readModelService: ReadModelService,
  emailManager: EmailManager
): Promise<void> {
  const { to, subject, body } = await getActivationMailFromAgreement(
    agreement,
    readModelService
  );

  await emailManager.send(config.senderEmailAddress, to, subject, body);
}
