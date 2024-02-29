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
  missingMessageDataError,
  EServiceId,
} from "pagopa-interop-models";
import {
  AuthorizationService,
  authorizationServiceBuilder,
} from "./authorization-service.js";

const getDescriptorFromEvent = (msg: {
  data: {
    descriptorId: string;
    eservice?: EServiceV2;
  };
}): {
  eserviceId: EServiceId;
  descriptor: Descriptor;
} => {
  if (!msg.data.eservice) {
    throw missingMessageDataError("eservice", "EServiceDescriptorPublished");
  }

  const eservice = fromEServiceV2(msg.data.eservice);
  const descriptor = eservice.descriptors.find(() => msg.data.descriptorId);

  if (!descriptor) {
    throw missingMessageDataError("descriptor", "EServiceDescriptorPublished");
  }

  return { eserviceId: eservice.id, descriptor };
};

function getprocessMessage(authService: AuthorizationService) {
  return async ({
    topic,
    message,
    partition,
  }: EachMessagePayload): Promise<void> => {
    try {
      const appContext = getContext();
      appContext.correlationId = uuidv4();

      const messageDecoder = messageDecoderSupplier(topic);
      const decodedMsg = messageDecoder(message);

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
            const data = getDescriptorFromEvent(msg);
            await authService.updateEServiceState(
              "ACTIVE",
              data.descriptor.id,
              data.eserviceId,
              data.descriptor.audience,
              data.descriptor.voucherLifespan
            );
          }
        )
        .with(
          {
            event_version: 2,
            type: "EServiceDescriptorSuspended",
          },
          async (msg) => {
            const data = getDescriptorFromEvent(msg);
            await authService.updateEServiceState(
              "INACTIVE",
              data.descriptor.id,
              data.eserviceId,
              data.descriptor.audience,
              data.descriptor.voucherLifespan
            );
          }
        );
      logger.info(
        `Authorization updated after ${JSON.stringify(
          decodedMsg.type
        )} event - Partition number: ${partition} - Offset: ${message.offset}`
      );
    } catch (e) {
      logger.error(
        ` Error during message handling. Partition number: ${partition}. Offset: ${message.offset}.\nError: ${e}`
      );
    }
  };
}

try {
  const authService = await authorizationServiceBuilder();
  const config = kafkaConsumerConfig();
  await runConsumer(config, getprocessMessage(authService)).catch(logger.error);
} catch (e) {
  logger.error(`Error during bootstrap:\n${e}`);
}
