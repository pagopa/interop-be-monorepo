/* eslint-disable functional/immutable-data */
import { v4 as uuidv4 } from "uuid";
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
} from "pagopa-interop-commons";
import {
  Descriptor,
  EServiceV2,
  fromEServiceV2,
  missingKafkaMessageDataError,
  kafkaMessageProcessError,
  EServiceId,
  EService,
} from "pagopa-interop-models";
import {
  AuthorizationService,
  authorizationServiceBuilder,
} from "./authorizationService.js";
import { ApiClientComponent } from "./model/models.js";

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
  topicConfig: CatalogTopicConfig,
  authService: AuthorizationService
) {
  return async (messagePayload: EachMessagePayload): Promise<void> => {
    try {
      const appContext = getContext();
      appContext.correlationId = uuidv4();

      const messageDecoder = messageDecoderSupplier(
        topicConfig,
        messagePayload.topic
      );
      const decodedMsg = messageDecoder(messagePayload.message);

      const updateSeed = match(decodedMsg)
        .with(
          {
            event_version: 2,
            type: "EServiceDescriptorPublished",
          },
          {
            event_version: 2,
            type: "EServiceDescriptorActivated",
          },
          (msg) => {
            const data = getDescriptorFromEvent(msg, decodedMsg.type);
            return {
              state: "ACTIVE",
              descriptorId: data.descriptor.id,
              eserviceId: data.eserviceId,
              audience: data.descriptor.audience,
              voucherLifespan: data.descriptor.voucherLifespan,
              eventType: decodedMsg.type,
            };
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
          (msg) => {
            const data = getDescriptorFromEvent(msg, decodedMsg.type);
            return {
              state: "INACTIVE",
              descriptorId: data.descriptor.id,
              eserviceId: data.eserviceId,
              audience: data.descriptor.audience,
              voucherLifespan: data.descriptor.voucherLifespan,
              eventType: decodedMsg.type,
            };
          }
        )
        .otherwise(() => undefined);

      if (updateSeed) {
        await executeUpdate(updateSeed.eventType, messagePayload, () =>
          authService.updateEServiceState(
            ApiClientComponent.parse(updateSeed.state),
            updateSeed.descriptorId,
            updateSeed.eserviceId,
            updateSeed.audience,
            updateSeed.voucherLifespan
          )
        );
      }
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
  const topicConfig: CatalogTopicConfig = catalogTopicConfig();
  await runConsumer(
    config,
    [topicConfig.catalogTopic],
    processMessage(topicConfig, authService)
  );
} catch (e) {
  logger.error(`An error occurred during initialization:\n${e}`);
}
