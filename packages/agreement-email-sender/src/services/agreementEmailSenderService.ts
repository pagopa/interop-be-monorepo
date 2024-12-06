import fs from "fs/promises";
import {
  EmailManager,
  EmailManagerKind,
  EmailManagerPEC,
  EmailManagerSES,
  HtmlTemplateService,
  Logger,
  dateAtRomeZone,
  emailManagerKind,
  getLatestTenantMailOfKind,
  initPecEmailManager,
  initSesMailManager,
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
  tenantMailKind,
  unsafeBrandId,
} from "pagopa-interop-models";
import path from "path";
import { fileURLToPath } from "url";
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
import { AgreementEmailSenderConfig } from "../config/config.js";

const agreementEventMailTemplateType = {
  activationPEC: "activation-pec-mail",
  activationSES: "activation-ses-mail",
  submission: "submission-mail",
} as const;

const AgreementEventMailTemplateType = z.enum([
  Object.values(agreementEventMailTemplateType)[0],
  ...Object.values(agreementEventMailTemplateType).slice(1),
]);

type AgreementEventMailTemplateType = z.infer<
  typeof AgreementEventMailTemplateType
>;

export const retrieveTenantMailAddress = (
  tenant: Tenant,
  managerEmailKind: EmailManagerKind
): TenantMail => {
  /*
    When email sender kind is PEC a certified email is sent
    so it require to use a digital address instead of a contact email 
  */
  const mailKind =
    managerEmailKind === emailManagerKind.pec
      ? tenantMailKind.DigitalAddress
      : tenantMailKind.ContactEmail;

  const digitalAddress = getLatestTenantMailOfKind(tenant.mails, mailKind);
  if (!digitalAddress) {
    throw tenantDigitalAddressNotFound(tenant.id);
  }
  return digitalAddress;
};

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
  recepientsEmail: string[]
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
    to: recepientsEmail,
    body: templateService.compileHtml(htmlTemplate, {
      activationDate,
      agreementId: agreement.id,
      eserviceName: eservice.name,
      eserviceVersion: descriptor.version,
      producerName,
      consumerName,
    }),
  };

  logger.info(
    `Sending email for agreement ${agreement.id} activation (${emailManager.kind})`
  );
  await emailManager.send(
    { name: sender.label, address: sender.mail },
    mail.to,
    mail.subject,
    mail.body
  );
  logger.info(
    `Email sent for agreement ${agreement.id} activation (${emailManager.kind})`
  );
}

export function agreementEmailSenderServiceBuilder(
  config: AgreementEmailSenderConfig,
  readModelService: ReadModelService,
  templateService: HtmlTemplateService
) {
  const sesEmailManager: EmailManagerSES = initSesMailManager(config);
  const pecEmailManager: EmailManagerPEC = initPecEmailManager(config);

  return {
    senderAgreementSubmissionEmail: async ({
      agreementV2,
      readModelService,
      feBaseUrl,
      sender,
      templateService,
      logger,
    }: {
      agreementV2: AgreementV2;
      readModelService: ReadModelService;
      feBaseUrl: string;
      sender: { label: string; mail: string };
      templateService: HtmlTemplateService;
      logger: Logger;
    }): Promise<void> => {
      const agreement = fromAgreementV2(agreementV2);
      const htmlTemplate = await retrieveHTMLTemplate(
        agreementEventMailTemplateType.submission
      );

      const eservice = await retrieveAgreementEservice(
        agreement,
        readModelService
      );

      const producer = await retrieveTenant(
        agreement.producerId,
        readModelService
      );
      const consumer = await retrieveTenant(
        agreement.consumerId,
        readModelService
      );

      const submissionDate = getFormattedAgreementStampDate(
        agreement,
        "submission"
      );

      const producerEmail = getLatestTenantMailOfKind(
        producer.mails,
        tenantMailKind.ContactEmail
      );

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
        await sesEmailManager.send(mail.from, mail.to, mail.subject, mail.body);
        logger.info(`Email sent for agreement ${agreement.id} submission`);
      } catch (err) {
        logger.warn(
          `Error sending email for agreement ${agreement.id}: ${err}`
        );
      }
    },
    sendAgreementActivationCertifiedEmail: async (
      agreementV2Msg: AgreementV2,
      logger: Logger
    ) => {
      const sender = {
        label: config.pecSenderLabel,
        mail: config.pecSenderMail,
      };
      const consumer = await retrieveTenant(
        unsafeBrandId(agreementV2Msg.consumerId),
        readModelService
      );
      const producer = await retrieveTenant(
        unsafeBrandId(agreementV2Msg.producerId),
        readModelService
      );

      const recepientsEmails = [
        retrieveTenantMailAddress(consumer, emailManagerKind.pec).address,
        retrieveTenantMailAddress(producer, emailManagerKind.pec).address,
      ];

      return sendAgreementActivationEmail(
        pecEmailManager,
        readModelService,
        agreementV2Msg,
        templateService,
        agreementEventMailTemplateType.activationPEC,
        logger,
        sender,
        consumer.name,
        producer.name,
        recepientsEmails
      );
    },
    sendAgreementActivationNotificationEmail: async (
      agreementV2Msg: AgreementV2,
      logger: Logger
    ) => {
      const sender = { label: config.senderLabel, mail: config.senderMail };
      const consumer = await retrieveTenant(
        unsafeBrandId(agreementV2Msg.consumerId),
        readModelService
      );
      const producer = await retrieveTenant(
        unsafeBrandId(agreementV2Msg.producerId),
        readModelService
      );

      const recepientsEmails = [
        retrieveTenantMailAddress(consumer, emailManagerKind.pec).address,
      ];

      return sendAgreementActivationEmail(
        sesEmailManager,
        readModelService,
        agreementV2Msg,
        templateService,
        agreementEventMailTemplateType.activationSES,
        logger,
        sender,
        consumer.name,
        producer.name,
        recepientsEmails
      );
    },
  };
}

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
