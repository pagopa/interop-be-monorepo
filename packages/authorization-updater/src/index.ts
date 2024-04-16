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
  PurposeV2,
  Purpose,
  PurposeVersion,
  PurposeId,
  purposeVersionState,
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

const getPurposeFromEvent = (
  msg: {
    data: {
      purpose?: PurposeV2;
    };
  },
  eventType: string
): Purpose => {
  if (!msg.data.purpose) {
    throw missingKafkaMessageDataError("purpose", eventType);
  }

  return fromPurposeV2(msg.data.purpose);
};

const getPurposeVersionFromEvent = (
  msg: {
    data: {
      purpose?: PurposeV2;
      versionId: string;
    };
  },
  eventType: string
): { purposeId: PurposeId; purposeVersion: PurposeVersion } => {
  const purpose = getPurposeFromEvent(msg, eventType);
  const purposeVersion = purpose.versions.find(
    (v) => v.id === msg.data.versionId
  );

  if (!purposeVersion) {
    throw missingKafkaMessageDataError("purposeVersion", eventType);
  }

  return { purposeId: purpose.id, purposeVersion };
};

async function executeUpdate(
  eventType: string,
  messagePayload: EachMessagePayload,
  update: () => Promise<unknown>
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
      const messageDecoder = match(messagePayload.topic)
        .with(catalogTopicConfig.catalogTopic, () =>
          messageDecoderSupplier(catalogTopicConfig, messagePayload.topic)
        )
        .with(purposeTopicConfig.purposeTopic, () =>
          messageDecoderSupplier(purposeTopicConfig, messagePayload.topic)
        )
        .otherwise(() => {
          throw new Error(`Unknown topic: ${messagePayload.topic}`);
        });

      const decodedMsg = messageDecoder(messagePayload.message);

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
            const purpose = getPurposeFromEvent(msg, msg.type);

            const purposeClients = await clients
              .find({
                "data.purposes.purpose.purposeId": purpose.id,
              })
              .map(({ data }) => ClientId.parse(data.id))
              .toArray();

            await executeUpdate(msg.type, messagePayload, () =>
              Promise.all(
                purposeClients.map((clientId) =>
                  authService.deletePurposeFromClient(purpose.id, clientId)
                )
              )
            );
          }
        )
        .with(
          {
            event_version: 2,
            type: "PurposeVersionSuspended",
          },
          {
            event_version: 2,
            type: "PurposeVersionSuspendedByConsumer",
          },
          {
            event_version: 2,
            type: "PurposeVersionSuspendedByProducer",
          },
          {
            event_version: 2,
            type: "PurposeVersionUnsuspendedByConsumer",
          },
          {
            event_version: 2,
            type: "PurposeVersionUnsuspendedByProducer",
          },
          {
            event_version: 2,
            type: "PurposeVersionOverQuotaUnsuspended",
          },
          {
            event_version: 2,
            type: "NewPurposeVersionActivated",
          },
          {
            event_version: 2,
            type: "NewPurposeVersionWaitingForApproval",
          },
          {
            event_version: 2,
            type: "PurposeVersionRejected",
          },
          {
            event_version: 2,
            type: "PurposeVersionActivated",
          },
          {
            event_version: 2,
            type: "PurposeArchived",
          },
          async (msg): Promise<void> => {
            const { purposeId, purposeVersion } = getPurposeVersionFromEvent(
              msg,
              msg.type
            );

            await executeUpdate(msg.type, messagePayload, () =>
              authService.updatePurposeState(
                purposeId,
                purposeVersion.id,
                purposeVersion.state === purposeVersionState.active
                  ? "ACTIVE"
                  : "INACTIVE"
              )
            );
          }
        )
        .with(
          {
            event_version: 2,
            type: "PurposeActivated",
          },
          {
            event_version: 2,
            type: "PurposeWaitingForApproval",
          },
          async (msg): Promise<void> => {
            const purpose = getPurposeFromEvent(msg, msg.type);

            const purposeVersion = purpose.versions[0];

            if (!purposeVersion) {
              throw missingKafkaMessageDataError("purposeVersion", msg.type);
            }

            await executeUpdate(msg.type, messagePayload, () =>
              authService.updatePurposeState(
                purpose.id,
                purposeVersion.id,
                purposeVersion.state === purposeVersionState.active
                  ? "ACTIVE"
                  : "INACTIVE"
              )
            );
          }
        )
        .otherwise(() => void 0);
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
