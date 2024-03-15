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
} from "pagopa-interop-commons";
import {
  Descriptor,
  EServiceV2,
  fromEServiceV2,
  missingKafkaMessageDataError,
  EServiceId,
  EService,
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

function processMessage(authService: AuthorizationService) {
  return async (messagePayload: EachMessagePayload): Promise<void> => {
    try {
      const appContext = getContext();
      appContext.correlationId = uuidv4();

      const messageDecoder = messageDecoderSupplier(messagePayload.topic);
      const decodedMsg = messageDecoder(messagePayload.message);

      match(decodedMsg)
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
            const data = getDescriptorFromEvent(msg, decodedMsg.type);
            await executeUpdate(decodedMsg.type, messagePayload, () =>
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
            const data = getDescriptorFromEvent(msg, decodedMsg.type);
            await executeUpdate(decodedMsg.type, messagePayload, () =>
              authService.updateEServiceState(
                "INACTIVE",
                data.descriptor.id,
                data.eserviceId,
                data.descriptor.audience,
                data.descriptor.voucherLifespan
              )
            );
          }
        );
    } catch (e) {
      logger.error(
        ` Error during message handling. Partition number: ${messagePayload.partition}. Offset: ${messagePayload.message.offset}.\nError: ${e}`
      );
    }
  };
}

try {
  const authService = await authorizationServiceBuilder();
  const config = kafkaConsumerConfig();
  await runConsumer(config, processMessage(authService));
} catch (e) {
  logger.error(`An error occurred during initialization:\n${e}`);
}
