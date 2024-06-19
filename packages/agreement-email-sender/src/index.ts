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
import {
  AgreementEvent,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { sendAgreementEmail } from "./services/agreementEmailSenderService.js";

const config = kafkaConsumerConfig();
const readModelConfig = readModelWriterConfig();
const topicsConfig = agreementTopicConfig();
const emailConfig = emailManagerConfig();
const emailManager = initEmailManager(emailConfig);
const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(readModelConfig)
);

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
    async ({ data: { agreement } }) => {
      if (agreement) {
        await sendAgreementEmail(agreement, readModelService, emailManager);
      } else {
        throw missingKafkaMessageDataError("agreement", decodedMessage.type);
      }
    }
  );
}

await runConsumer(config, [topicsConfig.agreementTopic], processMessage);
