import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import nodemailer from "nodemailer";
import {
  agreementTopicConfig,
  buildHTMLTemplateService,
  decodeKafkaMessage,
  kafkaConsumerConfig,
  logger,
} from "pagopa-interop-commons";
import {
  AgreementEvent,
  AgreementStateV2,
  AgreementV2,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { getEServiceById, getTenantById } from "./services/readModelService.js";

const config = kafkaConsumerConfig();
const topicsConfig = agreementTopicConfig();

export async function processMessage({
  message,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, AgreementEvent);
  const loggerInstance = logger({
    serviceName: "agreement-email-sender",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    correlationId: decodedMessage.correlation_id,
  });
  loggerInstance.debug(decodedMessage);

  match(decodedMessage).with(
    { event_version: 2, type: "AgreementActivated" },
    { event_version: 2, type: "AgreementSubmitted" },
    async ({ data: { agreement } }) => {
      if (agreement) {
        const email = await getActivationMailFromAgreement(agreement);
        loggerInstance.debug(email);
      } else {
        loggerInstance.error(
          `Agreement not found in message: ${decodedMessage.type}`
        );
      }
    }
  );
}

async function getActivationMailFromAgreement(
  agreement: AgreementV2
): Promise<string> {
  const templateService = buildHTMLTemplateService();
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);

  const htmlTemplateBuffer = await fs.readFile(
    `${dirname}/resources/templates/activation-mail.html`
  );
  const htmlTemplate = htmlTemplateBuffer.toString();

  // TODO check if second activation
  const activationDate =
    agreement.stamps?.activation?.when || new Date().toISOString();

  const [eservice, producer, consumer] = await Promise.all([
    getEServiceById(agreement.eserviceId),
    getTenantById(agreement.producerId),
    getTenantById(agreement.consumerId),
  ]);

  // TODO cosa fare se non trovo dei dati?
  return templateService.compileHtml(htmlTemplate, {
    activationDate,
    agreementId: agreement.id,
    eserviceName: eservice?.name,
    eserviceVersion: eservice?.descriptors.find((d) => d.id === agreement.id)
      ?.version,
    producerName: producer?.name,
    consumerName: consumer?.name,
  });
}

// TODO spostare in un modulo comune

const agreement: AgreementV2 = {
  id: "f6f19909-dfb6-4a96-8558-43a73c78f532",
  eserviceId: "e664e115-425e-4035-b58c-944b0de039d4",
  descriptorId: "3e850413-96f2-4e99-beca-32c6242cbfe9",
  producerId: "69e2865e-65ab-4e48-a638-2037a9ee2ee7",
  consumerId: "69e2865e-65ab-4e48-a638-2037a9ee2ee7",
  state: AgreementStateV2.ACTIVE,
  verifiedAttributes: [],
  createdAt: 0n,
  certifiedAttributes: [],
  declaredAttributes: [],
  consumerDocuments: [],
};

// eslint-disable-next-line no-console
const email = await getActivationMailFromAgreement(agreement);
const transporter = nodemailer.createTransport({
  host: "localhost",
  port: 1025,
  secure: false, // Use `true` for port 465, `false` for all other ports
});
await transporter.sendMail({
  from: "sandro.il.piu.bello.del.mondo@buildo.io", // sender address
  to: "sandro.ti.amo@buildo.io", // list of receivers
  subject: "Interoperabilità", // Subject line
  html: email, // html body
});

await runConsumer(config, [topicsConfig.agreementTopic], processMessage);
