/* eslint-disable functional/immutable-data */
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  CatalogTopicConfig,
  catalogTopicConfig,
  getContext,
  kafkaConsumerConfig,
  logger,
  loggerConfig,
  messageDecoderSupplier,
  notificationConfig,
} from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";
import { kafkaMessageProcessError } from "pagopa-interop-models";
import { convertToEserviceV1 } from "./models/catalogEventV2ConverterToV1.js";
import { buildCatalogMessage } from "./models/catalogEventMessage.js";
import { initQueueManager } from "./queue-manager/queueManager.js";

const config = kafkaConsumerConfig();
const topicsConfig = catalogTopicConfig();
const logConfig = loggerConfig();
const queueConfig = notificationConfig();
const queueManager = initQueueManager({
  queueUrl: queueConfig.queueUrl,
  messageGroupId: "message_group_all_notification",
  logLevel: logConfig.logLevel,
});

function processMessage(topicConfig: CatalogTopicConfig) {
  return async (kafkaMessage: EachMessagePayload): Promise<void> => {
    try {
      /* 
        TODO: handle correlationId from message when 
        PR https://github.com/pagopa/interop-be-monorepo/pull/310 is merged 
      */
      const appContext = getContext();
      appContext.correlationId = uuidv4();

      const messageDecoder = messageDecoderSupplier(
        topicConfig,
        kafkaMessage.topic
      );

      const eventEnvelope = messageDecoder(kafkaMessage.message);
      if (eventEnvelope.event_version !== 2) {
        logger.info(
          `Event version ${eventEnvelope.event_version} received not supported`
        );
        return;
      }

      const eserviceV1Event = convertToEserviceV1(eventEnvelope);
      const message = buildCatalogMessage(eventEnvelope, eserviceV1Event);
      await queueManager.send(message);

      logger.info(
        `Notification message [${message.messageUUID}] sent to queue ${queueConfig.queueUrl} for event type "${eventEnvelope.type}"`
      );
    } catch (e) {
      logger.error(
        `Error during message handling. Partition number: ${kafkaMessage.partition}. Offset: ${kafkaMessage.message.offset}, ${e}`
      );
      throw kafkaMessageProcessError(
        topicsConfig.catalogTopic,
        kafkaMessage.partition,
        kafkaMessage.message.offset,
        e
      );
    }
  };
}

await runConsumer(
  config,
  [topicsConfig.catalogTopic],
  processMessage(topicsConfig)
).catch(logger.error);
