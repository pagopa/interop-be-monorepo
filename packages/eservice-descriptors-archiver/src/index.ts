/* eslint-disable functional/immutable-data */
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  InteropTokenGenerator,
  RefreshableInteropToken,
  decodeKafkaMessage,
  logger,
} from "pagopa-interop-commons";
import {
  AgreementEvent,
  CorrelationId,
  fromAgreementV2,
  generateId,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  makeDrizzleConnection,
} from "pagopa-interop-readmodel";
import { catalogProcessClientBuilder } from "./services/catalogProcessClient.js";
import { config } from "./config/config.js";
import { archiveDescriptorForArchivedAgreement } from "./services/archiveDescriptorProcessor.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

const readModelDB = makeDrizzleConnection(config);
const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);

const readModelServiceSQL = readModelServiceBuilderSQL({
  agreementReadModelServiceSQL,
  catalogReadModelServiceSQL,
});

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
  const correlationId: CorrelationId = decodedMsg.correlation_id
    ? unsafeBrandId(decodedMsg.correlation_id)
    : generateId();

  const loggerInstance = logger({
    serviceName: "eservice-descriptors-archiver",
    eventType: decodedMsg.type,
    eventVersion: decodedMsg.event_version,
    streamId: decodedMsg.stream_id,
    streamVersion: decodedMsg.version,
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
            readModelServiceSQL,
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

await runConsumer(
  config,
  [config.agreementTopic],
  processMessage,
  "eservice-descriptors-archiver"
);
