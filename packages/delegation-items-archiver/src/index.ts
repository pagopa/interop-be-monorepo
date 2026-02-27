import { EachMessagePayload } from "kafkajs";
import {
  decodeKafkaMessage,
  InteropTokenGenerator,
  logger,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import {
  CorrelationId,
  DelegationEvent,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  agreementReadModelServiceBuilder,
  makeDrizzleConnection,
  purposeReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { handleMessageV2 } from "./delegationItemsArchiverConsumerServiceV2.js";
import { config } from "./config/config.js";
import { getInteropBeClients } from "./clients/clientsProvider.js";
import { readModelServiceBuilderSQL } from "./readModelServiceSQL.js";

const readModelDB = makeDrizzleConnection(config);
const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
const purposeReadModelServiceSQL = purposeReadModelServiceBuilder(readModelDB);

const readModelServiceSQL = readModelServiceBuilderSQL({
  readModelDB,
  agreementReadModelServiceSQL,
  purposeReadModelServiceSQL,
});

const refreshableToken = new RefreshableInteropToken(
  new InteropTokenGenerator(config)
);
await refreshableToken.init();

const { agreementProcessClient, purposeProcessClient } = getInteropBeClients();

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, DelegationEvent);

  const correlationId = decodedMessage.correlation_id
    ? unsafeBrandId<CorrelationId>(decodedMessage.correlation_id)
    : generateId<CorrelationId>();

  const loggerInstance = logger({
    serviceName: "delegation-items-archiver",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    streamVersion: decodedMessage.version,
    correlationId,
  });
  loggerInstance.debug(decodedMessage);

  await match(decodedMessage)
    .with({ event_version: 2 }, (msg) =>
      handleMessageV2({
        decodedMessage: msg,
        refreshableToken,
        partition,
        offset: message.offset,
        logger: loggerInstance,
        correlationId,
        readModelService: readModelServiceSQL,
        agreementProcessClient,
        purposeProcessClient,
      })
    )
    .exhaustive();
}

await runConsumer(
  config,
  [config.delegationTopic],
  processMessage,
  "delegation-items-archiver"
);
