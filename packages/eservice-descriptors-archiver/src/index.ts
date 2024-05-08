/* eslint-disable functional/immutable-data */
import { EachMessagePayload } from "kafkajs";
import {
  InteropTokenGenerator,
  ReadModelRepository,
  RefreshableInteropToken,
  decodeKafkaMessage,
  logger,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { AgreementEvent, fromAgreementV2 } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { eserviceDescriptorArchiverBuilder } from "./services/eserviceDescriptorsArchiver.js";
import { config } from "./utilities/config.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { catalogProcessClientBuilder } from "./services/catalogProcessClient.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);
const catalogProcessClient = catalogProcessClientBuilder(
  config.catalogProcessUrl
);
const tokenGenerator = new InteropTokenGenerator(config);
const refreshableToken = new RefreshableInteropToken(tokenGenerator);
await refreshableToken.init();

const eserviceDescriptorArchiver = await eserviceDescriptorArchiverBuilder(
  refreshableToken,
  readModelService,
  catalogProcessClient
);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMsg = decodeKafkaMessage(message, AgreementEvent);

  const loggerInstance = logger({
    serviceName: "eservice-descriptors-archiver",
    eventType: decodedMsg.type,
    eventVersion: decodedMsg.event_version,
    streamId: decodedMsg.stream_id,
    correlationId: decodedMsg.correlation_id,
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
          await eserviceDescriptorArchiver.archiveDescriptorsForArchivedAgreement(
            fromAgreementV2(agreement),
            loggerInstance,
            decodedMsg.correlation_id
          );
        } else {
          loggerInstance.error(
            `Agreement not found in message ${decodedMsg.type}`
          );
        }
      }
    )
    .otherwise(() => undefined);
}

await runConsumer(config, [config.agreementTopic], processMessage);
