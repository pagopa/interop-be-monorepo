/* eslint-disable functional/immutable-data */
import { runConsumer } from "kafka-iam-auth";
import { match } from "ts-pattern";
import { EachMessagePayload } from "kafkajs";
import {
  messageDecoderSupplier,
  kafkaConsumerConfig,
  logger,
  getContext,
  CatalogTopicConfig,
  catalogTopicConfig,
  PurposeTopicConfig,
  purposeTopicConfig,
  readModelDbConfig,
  ReadModelRepository,
  ClientCollection,
} from "pagopa-interop-commons";
import {
  Descriptor,
  EServiceV2,
  fromEServiceV2,
  missingKafkaMessageDataError,
  kafkaMessageProcessError,
  EServiceId,
  EService,
  ClientId,
  fromPurposeV2,
} from "pagopa-interop-models";
import {
  AuthorizationService,
  authorizationServiceBuilder,
} from "./authorizationService.js";

const getDescriptorFromEvent = (
  msg: {
    data: {
      descriptorId: string;
      eservice?: EServiceV2;
    };
  },
  eventType: string
): {
  eserviceId: EServiceId;
  descriptor: Descriptor;
} => {
  if (!msg.data.eservice) {
    throw missingKafkaMessageDataError("eservice", eventType);
  }

  const eservice: EService = fromEServiceV2(msg.data.eservice);
  const descriptor = eservice.descriptors.find(
    (d) => d.id === msg.data.descriptorId
  );

  if (!descriptor) {
    throw missingKafkaMessageDataError("descriptor", eventType);
  }

  return { eserviceId: eservice.id, descriptor };
};

async function executeUpdate(
  eventType: string,
  messagePayload: EachMessagePayload,
  update: () => Promise<void>
): Promise<void> {
  await update();
  logger.info(
    `Authorization updated after ${JSON.stringify(
      eventType
    )} event - Partition number: ${messagePayload.partition} - Offset: ${
      messagePayload.message.offset
    }`
  );
}

function processMessage(
  catalogTopicConfig: CatalogTopicConfig,
  purposeTopicConfig: PurposeTopicConfig,
  authService: AuthorizationService,
  clients: ClientCollection
) {
  return async (messagePayload: EachMessagePayload): Promise<void> => {
    try {
      const decodedMsg = match(messagePayload.topic)
        .with(catalogTopicConfig.catalogTopic, () =>
          messageDecoderSupplier(
            catalogTopicConfig,
            messagePayload.topic
          )(messagePayload.message)
        )
        .with(purposeTopicConfig.purposeTopic, () =>
          messageDecoderSupplier(
            purposeTopicConfig,
            messagePayload.topic
          )(messagePayload.message)
        )
        .otherwise(() => {
          throw new Error("");
        });

      const ctx = getContext();
      ctx.messageData = {
        eventType: decodedMsg.type,
        eventVersion: decodedMsg.event_version,
        streamId: decodedMsg.stream_id,
      };
      ctx.correlationId = decodedMsg.correlation_id;

      await match(decodedMsg)
        .with(
          {
            event_version: 2,
            type: "EServiceDescriptorPublished",
          },
          {
            event_version: 2,
            type: "EServiceDescriptorActivated",
          },
          async (msg) => {
            const data = getDescriptorFromEvent(msg, msg.type);
            await executeUpdate(msg.type, messagePayload, () =>
              authService.updateEServiceState(
                "ACTIVE",
                data.descriptor.id,
                data.eserviceId,
                data.descriptor.audience,
                data.descriptor.voucherLifespan
              )
            );
          }
        )
        .with(
          {
            event_version: 2,
            type: "EServiceDescriptorSuspended",
          },
          {
            event_version: 2,
            type: "EServiceDescriptorArchived",
          },
          async (msg) => {
            const data = getDescriptorFromEvent(msg, msg.type);
            await executeUpdate(msg.type, messagePayload, () =>
              authService.updateEServiceState(
                "INACTIVE",
                data.descriptor.id,
                data.eserviceId,
                data.descriptor.audience,
                data.descriptor.voucherLifespan
              )
            );
          }
        )
        .with(
          {
            event_version: 2,
            type: "DraftPurposeDeleted",
          },
          {
            event_version: 2,
            type: "WaitingForApprovalPurposeDeleted",
          },
          async (msg): Promise<void> => {
            if (!msg.data.purpose) {
              throw missingKafkaMessageDataError("purpose", msg.type);
            }

            const purpose = fromPurposeV2(msg.data.purpose);

            const purposeClients = await clients
              .find({
                "data.purposes.purpose.purposeId": purpose.id,
              })
              .map(({ data }) => ClientId.parse(data.id))
              .toArray();

            await Promise.all(
              purposeClients.map((clientId) =>
                authService.deletePurposeFromClient(purpose.id, clientId)
              )
            );
          }
        )
        .otherwise(() => undefined);
    } catch (e) {
      throw kafkaMessageProcessError(
        messagePayload.topic,
        messagePayload.partition,
        messagePayload.message.offset,
        e
      );
    }
  };
}

try {
  const authService = await authorizationServiceBuilder();
  const config = kafkaConsumerConfig();
  const catalogTopicConf: CatalogTopicConfig = catalogTopicConfig();
  const purposeTopicConf: PurposeTopicConfig = purposeTopicConfig();

  const { clients } = ReadModelRepository.init(readModelDbConfig());

  await runConsumer(
    config,
    [catalogTopicConf.catalogTopic, purposeTopicConf.purposeTopic],
    processMessage(catalogTopicConf, purposeTopicConf, authService, clients)
  );
} catch (e) {
  logger.error(`An error occurred during initialization:\n${e}`);
}
