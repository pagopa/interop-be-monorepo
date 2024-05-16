/* eslint-disable functional/immutable-data */
import { runConsumer } from "kafka-iam-auth";
import { match } from "ts-pattern";
import { EachMessagePayload } from "kafkajs";
import {
  kafkaConsumerConfig,
  logger,
  CatalogTopicConfig,
  Logger,
  genericLogger,
  AgreementTopicConfig,
  catalogTopicConfig,
  agreementTopicConfig,
  messageDecoderSupplier,
} from "pagopa-interop-commons";
import {
  Descriptor,
  EServiceV2,
  fromEServiceV2,
  missingKafkaMessageDataError,
  kafkaMessageProcessError,
  EServiceId,
  EService,
  genericInternalError,
  Agreement,
  agreementState,
  AgreementV2,
  fromAgreementV2,
} from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
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

const getAgreementFromEvent = (
  msg: {
    data: {
      agreement?: AgreementV2;
    };
  },
  eventType: string
): Agreement => {
  if (!msg.data.agreement) {
    throw missingKafkaMessageDataError("agreement", eventType);
  }

  return fromAgreementV2(msg.data.agreement);
};

async function executeUpdate(
  eventType: string,
  messagePayload: EachMessagePayload,
  update: () => Promise<void>,
  logger: Logger
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
  agreementTopicConfig: AgreementTopicConfig,
  authService: AuthorizationService
) {
  return async (messagePayload: EachMessagePayload): Promise<void> => {
    try {
      const decodedMsg = match(messagePayload.topic)
        .with(catalogTopicConfig.catalogTopic, () =>
          messageDecoderSupplier(catalogTopicConfig)(messagePayload.message)
        )
        .with(agreementTopicConfig.agreementTopic, () =>
          messageDecoderSupplier(agreementTopicConfig)(messagePayload.message)
        )
        .otherwise(() => {
          throw genericInternalError(`Unknown topic: ${messagePayload.topic}`);
        });
      const correlationId = decodedMsg.correlation_id || uuidv4();

      const loggerInstance = logger({
        serviceName: "authorization-updater",
        eventType: decodedMsg.type,
        eventVersion: decodedMsg.event_version,
        streamId: decodedMsg.stream_id,
        correlationId,
      });

      const update: (() => Promise<void>) | undefined = match(decodedMsg)
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
            return (): Promise<void> =>
              authService.updateEServiceState(
                ApiClientComponent.Values.ACTIVE,
                data.descriptor.id,
                data.eserviceId,
                data.descriptor.audience,
                data.descriptor.voucherLifespan,
                loggerInstance,
                correlationId
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
          (msg) => {
            const data = getDescriptorFromEvent(msg, decodedMsg.type);
            return (): Promise<void> =>
              authService.updateEServiceState(
                ApiClientComponent.Values.INACTIVE,
                data.descriptor.id,
                data.eserviceId,
                data.descriptor.audience,
                data.descriptor.voucherLifespan,
                loggerInstance,
                correlationId
              );
          }
        )
        .with(
          {
            event_version: 2,
            type: "AgreementSubmitted",
          },
          (msg) => {
            const agreement = getAgreementFromEvent(msg, decodedMsg.type);
            const newClientState = match(agreement.state)
              .with(agreementState.active, () => "ACTIVE")
              .with(agreementState.suspended, () => "INACTIVE")
              .otherwise(() => undefined);

            return newClientState
              ? (): Promise<void> =>
                  authService.updateAgreementState(
                    ApiClientComponent.Values.ACTIVE,
                    agreement.id,
                    agreement.eserviceId,
                    agreement.consumerId,
                    correlationId
                  )
              : undefined;
          }
        )
        .otherwise(() => undefined);

      if (update) {
        await executeUpdate(
          decodedMsg.type,
          messagePayload,
          update,
          loggerInstance
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
  const catalogTopicConf: CatalogTopicConfig = catalogTopicConfig();
  const agreementTopicConf: AgreementTopicConfig = agreementTopicConfig();
  await runConsumer(
    config,
    [catalogTopicConf.catalogTopic, agreementTopicConf.agreementTopic],
    processMessage(catalogTopicConf, agreementTopicConf, authService)
  );
} catch (e) {
  genericLogger.error(`An error occurred during initialization:\n${e}`);
}
