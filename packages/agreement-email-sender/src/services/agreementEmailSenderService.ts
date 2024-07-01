import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import {
  Agreement,
  AgreementV2,
  EService,
  Tenant,
  TenantMail,
  fromAgreementV2,
  tenantMailKind,
} from "pagopa-interop-models";
import {
  EmailManager,
  HtmlTemplateService,
  Logger,
  dateAtRomeZone,
} from "pagopa-interop-commons";
import {
  descriptorNotFound,
  eServiceNotFound,
  htmlTemplateNotFound,
  tenantDigitalAddressNotFound,
  tenantNotFound,
  agreementStampDateNotFound,
} from "../models/errors.js";
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

export async function sendAgreementActivationEmail({
  agreementV2,
  readModelService,
  emailManager,
  sender,
  templateService,
  logger,
}: {
  agreementV2: AgreementV2;
  readModelService: ReadModelService;
  emailManager: EmailManager;
  sender: { label: string; mail: string };
  templateService: HtmlTemplateService;
  logger: Logger;
}): Promise<void> {
  const agreement = fromAgreementV2(agreementV2);
  const htmlTemplate = await retrieveHTMLTemplate("activation-mail");

  const activationDate = getFormattedAgreementStampDate(
    agreement,
    "activation"
  );

  const { eservice, producer, consumer } = await retrieveAgreementComponents(
    agreement,
    readModelService
  );

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

  const mail = {
    subject: `Richiesta di fruizione ${agreement.id} attiva`,
    to: [producerEmail, consumerEmail],
    body: templateService.compileHtml(htmlTemplate, {
      activationDate,
      agreementId: agreement.id,
      eserviceName: eservice.name,
      eserviceVersion: descriptor.version,
      producerName: producer.name,
      consumerName: consumer.name,
    }),
  };

  logger.info(`Sending email for agreement ${agreement.id} activation`);
  await emailManager.send(
    { name: sender.label, address: sender.mail },
    mail.to,
    mail.subject,
    mail.body
  );
  logger.info(`Email sent for agreement ${agreement.id} activation`);
}

export async function senderAgreementSubmissionEmail({
  agreementV2,
  readModelService,
  feBaseUrl,
  emailManager,
  sender,
  templateService,
  logger,
}: {
  agreementV2: AgreementV2;
  readModelService: ReadModelService;
  feBaseUrl: string;
  emailManager: EmailManager;
  sender: { label: string; mail: string };
  templateService: HtmlTemplateService;
  logger: Logger;
}): Promise<void> {
  const agreement = fromAgreementV2(agreementV2);
  const htmlTemplate = await retrieveHTMLTemplate("submission-mail");

  const { eservice, producer, consumer } = await retrieveAgreementComponents(
    agreement,
    readModelService
  );

  const submissionDate = getFormattedAgreementStampDate(
    agreement,
    "submission"
  );

  const producerEmail = [...producer.mails]
    .filter((m) => m.kind === "CONTACT_EMAIL")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

  if (!producerEmail) {
    logger.warn(
      `Producer email not found for agreement ${agreement.id}, skipping email`
    );
    return;
  }

  const mail = {
    from: { name: sender.label, address: sender.mail },
    subject: `Nuova richiesta di fruizione per ${eservice.name} ricevuta`,
    to: [producerEmail.address],
    body: templateService.compileHtml(htmlTemplate, {
      interopFeUrl: `https://${feBaseUrl}/ui/it/erogazione/richieste/${agreement.id}`,
      producerName: producer.name,
      consumerName: consumer.name,
      eserviceName: eservice.name,
      submissionDate,
    }),
  };

  try {
    logger.info(`Sending email for agreement ${agreement.id} submission`);
    await emailManager.send(mail.from, mail.to, mail.subject, mail.body);
    logger.info(`Email sent for agreement ${agreement.id} submission`);
  } catch (err) {
    logger.error(`Error sending email for agreement ${agreement.id}: ${err}`);
  }
}

async function retrieveAgreementComponents(
  agreement: Agreement,
  readModelService: ReadModelService
): Promise<{
  eservice: EService;
  producer: Tenant;
  consumer: Tenant;
}> {
  const { getTenantById, getEServiceById } = readModelService;

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

  return { eservice, producer, consumer };
}

async function retrieveHTMLTemplate(
  templateName: "activation-mail" | "submission-mail"
): Promise<string> {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  const templatePath = `/resources/templates/${templateName}.html`;

  try {
    const htmlTemplateBuffer = await fs.readFile(
      `${dirname}/..${templatePath}`
    );
    return htmlTemplateBuffer.toString();
  } catch {
    throw htmlTemplateNotFound(templatePath);
  }
}

function getFormattedAgreementStampDate(
  agreement: Agreement,
  stamp: keyof Agreement["stamps"]
): string {
  const stampDate = agreement.stamps[stamp]?.when;

  if (stampDate === undefined) {
    throw agreementStampDateNotFound(stamp, agreement.id);
  }
  return dateAtRomeZone(new Date(Number(stampDate)));
}
