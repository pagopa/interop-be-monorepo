/* eslint-disable functional/immutable-data */
import { EachMessagePayload } from "kafkajs";
import {
  InteropTokenGenerator,
  ReadModelRepository,
  RefreshableInteropToken,
  decodeKafkaMessage,
  logger,
  runWithContext,
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

  await runWithContext(
    {
      messageData: {
        eventType: decodedMsg.type,
        eventVersion: decodedMsg.event_version,
        streamId: decodedMsg.stream_id,
      },
      correlationId: decodedMsg.correlation_id,
    },
    async () =>
      match(decodedMsg)
        .with(
          {
            event_version: 2,
            type: "AgreementArchivedByUpgrade",
          },
          {
            event_version: 2,
            type: "AgreementArchived",
          },
          async ({ data: { agreement } }) => {
            if (agreement) {
              logger.info(
                `Processing ${decodedMsg.type} message - Partition number: ${partition} - Offset: ${message.offset}`
              );
              await eserviceDescriptorArchiver.archiveDescriptorsForArchivedAgreement(
                fromAgreementV2(agreement)
              );
            } else {
              logger.error(`Agreement not found in message ${decodedMsg.type}`);
            }
          }
        )
        .otherwise(() => undefined)
  );
}

await runConsumer(config, [config.agreementTopic], processMessage);
