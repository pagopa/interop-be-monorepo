/* eslint-disable functional/immutable-data */
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  InteropTokenGenerator,
  ReadModelRepository,
  RefreshableInteropToken,
  decodeKafkaMessage,
  logger,
} from "pagopa-interop-commons";
import {
  AgreementEvent,
  fromAgreementV2,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { v4 as uuidv4 } from "uuid";
import { catalogProcessClientBuilder } from "./services/catalogProcessClient.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { config } from "./config/config.js";
import { archiveDescriptorForArchivedAgreement } from "./services/archiveDescriptorProcessor.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);
const catalogProcessClient = catalogProcessClientBuilder(
  config.catalogProcessUrl
);
const tokenGenerator = new InteropTokenGenerator(config);
const refreshableToken = new RefreshableInteropToken(tokenGenerator);
await refreshableToken.init();

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMsg = decodeKafkaMessage(message, AgreementEvent);
  const correlationId = decodedMsg.correlation_id || uuidv4();

  const loggerInstance = logger({
    serviceName: "eservice-descriptors-archiver",
    eventType: decodedMsg.type,
    eventVersion: decodedMsg.event_version,
    streamId: decodedMsg.stream_id,
    correlationId,
  });

  await match(decodedMsg)
    .with(
      {
        event_version: 2,
        type: "AgreementArchivedByUpgrade",
      },
      {
        event_version: 2,
        type: "AgreementArchivedByConsumer",
      },
      async ({ data: { agreement } }) => {
        if (agreement) {
          loggerInstance.info(
            `Processing ${decodedMsg.type} message - Partition number: ${partition} - Offset: ${message.offset}`
          );
          await archiveDescriptorForArchivedAgreement(
            fromAgreementV2(agreement),
            refreshableToken,
            readModelService,
            catalogProcessClient,
            loggerInstance,
            correlationId
          );
        } else {
          throw missingKafkaMessageDataError("agreement", decodedMsg.type);
        }
      }
    )
    .otherwise(() => undefined);
}

await runConsumer(config, [config.agreementTopic], processMessage);
