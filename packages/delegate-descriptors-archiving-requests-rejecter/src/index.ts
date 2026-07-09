/* eslint-disable functional/immutable-data */
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  getInteropHeaders,
  InteropTokenGenerator,
  RefreshableInteropToken,
  decodeKafkaMessage,
  logger,
} from "pagopa-interop-commons";
import {
  CorrelationId,
  DelegationEvent,
  EServiceEvent,
  fromDelegationV2,
  fromEServiceV2,
  generateId,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  catalogReadModelServiceBuilder,
  makeDrizzleConnection,
} from "pagopa-interop-readmodel";
import { catalogProcessClientBuilder } from "./services/catalogProcessClient.js";
import { config } from "./config/config.js";
import {
  processDelegationRevokedEvent,
  processDescriptorArchivedEvent,
} from "./services/delegatedArchivingRequestsProcessor.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

const readModelDB = makeDrizzleConnection(config);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);

const readModelServiceSQL = readModelServiceBuilderSQL({
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
  topic,
}: EachMessagePayload): Promise<void> {
  if (topic === config.catalogTopic) {
    const decodedMessage = decodeKafkaMessage(message, EServiceEvent);
    const correlationId: CorrelationId = decodedMessage.correlation_id
      ? unsafeBrandId(decodedMessage.correlation_id)
      : generateId();

    const loggerInstance = logger({
      serviceName: "delegate-descriptors-archiving-requests-rejecter",
      eventType: decodedMessage.type,
      eventVersion: decodedMessage.event_version,
      streamId: decodedMessage.stream_id,
      streamVersion: decodedMessage.version,
      correlationId,
    });

    await match(decodedMessage)
      .with(
        {
          event_version: 2,
          type: "EServiceDescriptorArchived",
        },
        async ({ data: { descriptorId, eservice } }) => {
          loggerInstance.info(
            `Processing EServiceDescriptorArchived message - Partition number: ${partition} - Offset: ${message.offset}`
          );

          if (!eservice) {
            throw missingKafkaMessageDataError("eservice", decodedMessage.type);
          }

          const token = (await refreshableToken.get()).serialized;
          const headers = getInteropHeaders({
            token,
            correlationId,
          });

          await processDescriptorArchivedEvent({
            eservice: fromEServiceV2(eservice),
            descriptorId: unsafeBrandId(descriptorId),
            catalogProcessClient,
            headers,
            logger: loggerInstance,
          });
        }
      )
      .otherwise(() => undefined);

    return;
  }

  if (topic !== config.delegationTopic) {
    return;
  }

  const decodedMessage = decodeKafkaMessage(message, DelegationEvent);
  const correlationId: CorrelationId = decodedMessage.correlation_id
    ? unsafeBrandId(decodedMessage.correlation_id)
    : generateId();

  const loggerInstance = logger({
    serviceName: "delegate-descriptors-archiving-requests-rejecter",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    streamVersion: decodedMessage.version,
    correlationId,
  });

  await match(decodedMessage)
    .with(
      {
        event_version: 2,
        type: "ConsumerDelegationRevoked",
      },
      {
        event_version: 2,
        type: "ProducerDelegationRevoked",
      },
      async ({ data: { delegation }, type }) => {
        loggerInstance.info(
          `Processing ${type} message - Partition number: ${partition} - Offset: ${message.offset}`
        );

        if (!delegation) {
          throw missingKafkaMessageDataError("delegation", type);
        }

        const token = (await refreshableToken.get()).serialized;
        const headers = getInteropHeaders({
          token,
          correlationId,
        });

        await processDelegationRevokedEvent({
          delegation: fromDelegationV2(delegation),
          readModelService: readModelServiceSQL,
          catalogProcessClient,
          headers,
          logger: loggerInstance,
        });
      }
    )
    .otherwise(() => undefined);
}

await runConsumer(
  config,
  [config.catalogTopic, config.delegationTopic],
  processMessage,
  "delegate-descriptors-archiving-requests-rejecter"
);
