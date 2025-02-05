/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-params */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  EmailManager,
  EmailManagerPEC,
  HtmlTemplateService,
  Logger,
  dateAtRomeZone,
  getLatestTenantMailOfKind,
} from "pagopa-interop-commons";
import {
  Agreement,
  AgreementV2,
  Descriptor,
  EService,
  Tenant,
  TenantId,
  TenantMail,
  fromAgreementV2,
  genericInternalError,
  tenantMailKind,
  unsafeBrandId,
} from "pagopa-interop-models";
import { z } from "zod";
import {
  agreementStampDateNotFound,
  descriptorNotFound,
  eServiceNotFound,
  htmlTemplateNotFound,
  tenantDigitalAddressNotFound,
  tenantNotFound,
} from "../models/errors.js";
import { ReadModelService } from "./readModelService.js";

// Be careful to change this enum, it's used to find the html template files
export const agreementEventMailTemplateType = {
  agreementActivationPEC: "agreement-activation-pec-mail",
} as const;

const AgreementEventMailTemplateType = z.enum([
  Object.values(agreementEventMailTemplateType)[0],
  ...Object.values(agreementEventMailTemplateType).slice(1),
]);

type AgreementEventMailTemplateType = z.infer<
  typeof AgreementEventMailTemplateType
>;

const retrieveTenantDigitalAddress = (tenant: Tenant): TenantMail => {
  const digitalAddress = getLatestTenantMailOfKind(
    tenant.mails,
    tenantMailKind.DigitalAddress
  );
  if (!digitalAddress) {
    throw tenantDigitalAddressNotFound(tenant.id);
  }
  return digitalAddress;
};

async function retrieveAgreementEservice(
  agreement: Agreement,
  readModelService: ReadModelService
): Promise<EService> {
  const eservice = await readModelService.getEServiceById(agreement.eserviceId);

  if (!eservice) {
    throw eServiceNotFound(agreement.eserviceId);
  }

  return eservice;
}

async function retrieveTenant(
  tenantId: TenantId,
  readModelService: ReadModelService
): Promise<Tenant> {
  const tenant = await readModelService.getTenantById(tenantId);
  if (!tenant) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
}

function retrieveAgreementDescriptor(
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

async function retrieveHTMLTemplate(
  templateKind: AgreementEventMailTemplateType
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

async function sendAgreementActivationEmail(
  emailManager: EmailManager,
  readModelService: ReadModelService,
  agreementV2Msg: AgreementV2,
  templateService: HtmlTemplateService,
  templateKind: AgreementEventMailTemplateType,
  logger: Logger,
  sender: { label: string; mail: string },
  consumerName: string,
  producerName: string,
  recipientsEmails: string[],
  interopFeUrl?: string
): Promise<void> {
  const agreement = fromAgreementV2(agreementV2Msg);
  const htmlTemplate = await retrieveHTMLTemplate(templateKind);

  const activationDate = getFormattedAgreementStampDate(
    agreement,
    "activation"
  );

  const eservice = await retrieveAgreementEservice(agreement, readModelService);
  const descriptor = retrieveAgreementDescriptor(eservice, agreement);
  const mail = {
    subject: `Richiesta di fruizione ${agreement.id} attiva`,
    to: recipientsEmails,
    body: templateService.compileHtml(htmlTemplate, {
      activationDate,
      agreementId: agreement.id,
      eserviceName: eservice.name,
      eserviceVersion: descriptor.version,
      producerName,
      consumerName,
      interopFeUrl,
    }),
  };
  try {
    logger.info(
      `Sending certified email for agreement ${agreement.id} activation`
    );
    await emailManager.send(
      { name: sender.label, address: sender.mail },
      mail.to,
      mail.subject,
      mail.body
    );
    logger.info(
      `Certified email sent for agreement ${agreement.id} activation`
    );
  } catch (err) {
    logger.error(
      `Unexpected error sending certified email for agreement ${agreement.id} activation: ${err}`
    );
    throw genericInternalError(
      `Error sending certified email for agreement ${agreement.id}: ${err}`
    );
  }
}

export function certifiedEmailSenderServiceBuilder(
  pecEmailManager: EmailManagerPEC,
  pecSenderData: { label: string; mail: string },
  readModelService: ReadModelService,
  templateService: HtmlTemplateService
) {
  return {
    sendAgreementActivationCertifiedEmail: async (
      agreementV2Msg: AgreementV2,
      logger: Logger
    ) => {
      const consumer = await retrieveTenant(
        unsafeBrandId(agreementV2Msg.consumerId),
        readModelService
      );
      const producer = await retrieveTenant(
        unsafeBrandId(agreementV2Msg.producerId),
        readModelService
      );

      const recepientsEmails = [
        retrieveTenantDigitalAddress(consumer).address,
        retrieveTenantDigitalAddress(producer).address,
      ];

      return sendAgreementActivationEmail(
        pecEmailManager,
        readModelService,
        agreementV2Msg,
        templateService,
        agreementEventMailTemplateType.agreementActivationPEC,
        logger,
        pecSenderData,
        consumer.name,
        producer.name,
        recepientsEmails
      );
    },
  };
}
