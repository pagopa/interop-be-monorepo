import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  ReadModelRepository,
  agreementTopicConfig,
  decodeKafkaMessage,
  emailManagerConfig,
  initEmailManager,
  kafkaConsumerConfig,
  logger,
  readModelWriterConfig,
} from "pagopa-interop-commons";
import { AgreementEvent } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { selfcareV2Client } from "pagopa-interop-selfcare-v2-client";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { getActivationMailFromAgreement } from "./services/agreementEmailSenderService.js";

const config = kafkaConsumerConfig();
const readModelConfig = readModelWriterConfig();
const topicsConfig = agreementTopicConfig();

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(readModelConfig)
);

const emailManager = initEmailManager(emailManagerConfig());

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
        const { from, to, subject, body } =
          await getActivationMailFromAgreement(
            agreement,
            readModelService,
            selfcareV2Client
          );
        loggerInstance.debug(body);
        await emailManager.send(from, to, subject, body);
      } else {
        loggerInstance.error(
          `Agreement not found in message: ${decodedMessage.type}`
        );
      }
    }
  );
}

await runConsumer(config, [topicsConfig.agreementTopic], processMessage);
