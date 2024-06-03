import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import { AgreementV2, genericInternalError } from "pagopa-interop-models";
import {
  EmailManager,
  buildHTMLTemplateService,
  dateAtRomeZone,
} from "pagopa-interop-commons";
import { SelfcareV2Client } from "pagopa-interop-selfcare-v2-client";
import { ReadModelService } from "./readModelService.js";

async function getActivationMailFromAgreement(
  agreement: AgreementV2,
  readModelService: ReadModelService,
  selfcareV2Client: SelfcareV2Client
): Promise<{
  subject: string;
  body: string;
  to: string[];
}> {
  const templateService = buildHTMLTemplateService();
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);

  const { getEServiceById, getTenantById } = readModelService;

  const htmlTemplateBuffer = await fs.readFile(
    `${dirname}/../resources/templates/activation-mail.html`
  );
  const htmlTemplate = htmlTemplateBuffer.toString();

  const activationDate = agreement.stamps?.activation?.when;

  if (activationDate === undefined) {
    throw genericInternalError(
      `Activation date not found for agreement ${agreement.id}`
    );
  }
  const formattedActivationDate = dateAtRomeZone(
    new Date(Number(activationDate))
  );

  const [
    eservice,
    producer,
    consumer,
    { digitalAddress: consumerEmail },
    { digitalAddress: producerEmail },
  ] = await Promise.all([
    getEServiceById(agreement.eserviceId),
    getTenantById(agreement.producerId),
    getTenantById(agreement.consumerId),
    selfcareV2Client.getInstitution({
      params: { id: agreement.consumerId },
    }),
    selfcareV2Client.getInstitution({
      params: { id: agreement.producerId },
    }),
  ]);

  if (!eservice) {
    throw genericInternalError(
      `EService not found for agreement ${agreement.id}`
    );
  }
  if (!producer) {
    throw genericInternalError(
      `Produce tenant not found for agreement ${agreement.id}`
    );
  }

  if (!consumer) {
    throw genericInternalError(
      `Consumer tenant not found for agreement ${agreement.id}`
    );
  }

  if (!producerEmail) {
    throw genericInternalError(
      `Producer digital address not found for agreement ${agreement.id}`
    );
  }

  if (!consumerEmail) {
    throw genericInternalError(
      `Consumer digital address not found for agreement ${agreement.id}`
    );
  }

  return {
    subject: `Richiesta di fruizione ${agreement.id} attiva`,
    to: [producerEmail, consumerEmail],
    body: templateService.compileHtml(htmlTemplate, {
      activationDate: formattedActivationDate,
      agreementId: agreement.id,
      eserviceName: eservice?.name,
      eserviceVersion: eservice?.descriptors.find(
        (d) => d.id === agreement.descriptorId
      )?.version,
      producerName: producer?.name,
      consumerName: consumer?.name,
    }),
  };
}

export async function sendAgreementEmail(
  agreement: AgreementV2,
  readModelService: ReadModelService,
  selfcareV2Client: SelfcareV2Client,
  emailManager: EmailManager
): Promise<void> {
  const { to, subject, body } = await getActivationMailFromAgreement(
    agreement,
    readModelService,
    selfcareV2Client
  );

  await emailManager.send(emailManager.getSender(), to, subject, body);
}
