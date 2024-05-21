/* eslint-disable functional/immutable-data */
import { runConsumer } from "kafka-iam-auth";
import { match } from "ts-pattern";
import { EachMessagePayload } from "kafkajs";
import {
  logger,
  CatalogTopicConfig,
  Logger,
  genericLogger,
  AgreementTopicConfig,
  ReadModelRepository,
  InteropTokenGenerator,
  RefreshableInteropToken,
  decodeKafkaMessage,
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
  descriptorState,
  EServiceEventEnvelopeV2,
  EServiceEventV2,
  AgreementEventV2,
  AgreementEventEnvelopeV2,
} from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import {
  AuthorizationService,
  authorizationServiceBuilder,
} from "./authorizationService.js";
import { ApiClientComponent, ApiClientComponentState } from "./model/models.js";
import { config } from "./utilities/config.js";
import {
  ReadModelService,
  readModelServiceBuilder,
} from "./readModelService.js";
import { authorizationManagementClientBuilder } from "./authorizationManagementClient.js";

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

const agreementStateToClientState = (
  agreement: Agreement
): ApiClientComponentState =>
  match(agreement.state)
    .with(agreementState.active, () => ApiClientComponent.Values.ACTIVE)
    .otherwise(() => ApiClientComponent.Values.INACTIVE);

export async function sendAuthUpdate(
  decodedMessage: EServiceEventEnvelopeV2 | AgreementEventEnvelopeV2,
  readModelService: ReadModelService,
  authService: AuthorizationService,
  loggerInstance: Logger,
  correlationId: string
): Promise<void> {
  const update: (() => Promise<void>) | undefined = await match(decodedMessage)
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
        const data = getDescriptorFromEvent(msg, decodedMessage.type);
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
      async (msg) => {
        const data = getDescriptorFromEvent(msg, decodedMessage.type);
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
      {
        event_version: 2,
        type: "AgreementActivated",
      },
      {
        event_version: 2,
        type: "AgreementUnsuspendedByPlatform",
      },
      {
        event_version: 2,
        type: "AgreementUnsuspendedByConsumer",
      },
      {
        event_version: 2,
        type: "AgreementUnsuspendedByProducer",
      },
      {
        event_version: 2,
        type: "AgreementSuspendedByPlatform",
      },
      {
        event_version: 2,
        type: "AgreementSuspendedByConsumer",
      },
      {
        event_version: 2,
        type: "AgreementSuspendedByProducer",
      },
      {
        event_version: 2,
        type: "AgreementArchivedByConsumer",
      },
      {
        event_version: 2,
        type: "AgreementArchivedByUpgrade",
      },
      async (msg) => {
        const agreement = getAgreementFromEvent(msg, decodedMessage.type);

        return (): Promise<void> =>
          authService.updateAgreementState(
            agreementStateToClientState(agreement),
            agreement.id,
            agreement.eserviceId,
            agreement.consumerId,
            loggerInstance,
            correlationId
          );
      }
    )
    .with(
      {
        event_version: 2,
        type: "AgreementUpgraded",
      },
      async (msg) => {
        const agreement = getAgreementFromEvent(msg, decodedMessage.type);
        const eservice = await readModelService.getEServiceById(
          agreement.eserviceId
        );
        if (!eservice) {
          throw genericInternalError(
            `Unable to find EService with id ${agreement.eserviceId}`
          );
        }

        const descriptor = eservice.descriptors.find(
          (d) => d.id === agreement.descriptorId
        );
        if (!descriptor) {
          throw genericInternalError(
            `Unable to find descriptor with id ${agreement.descriptorId}`
          );
        }

        const eserviceClientState = match(descriptor.state)
          .with(
            descriptorState.published,
            descriptorState.deprecated,
            () => ApiClientComponent.Values.ACTIVE
          )
          .otherwise(() => ApiClientComponent.Values.INACTIVE);

        return (): Promise<void> =>
          authService.updateAgreementAndEServiceStates(
            agreementStateToClientState(agreement),
            eserviceClientState,
            agreement.id,
            agreement.eserviceId,
            agreement.descriptorId,
            agreement.consumerId,
            descriptor.audience,
            descriptor.voucherLifespan,
            loggerInstance,
            correlationId
          );
      }
    )
    .otherwise(() => undefined);

  if (update) {
    await update();
  }
}

function processMessage(
  catalogTopicConfig: CatalogTopicConfig,
  agreementTopicConfig: AgreementTopicConfig,
  readModelService: ReadModelService,
  authService: AuthorizationService
) {
  return async (messagePayload: EachMessagePayload): Promise<void> => {
    try {
      const decodedMessage = match(messagePayload.topic)
        .with(catalogTopicConfig.catalogTopic, () =>
          decodeKafkaMessage(messagePayload.message, EServiceEventV2)
        )
        .with(agreementTopicConfig.agreementTopic, () =>
          decodeKafkaMessage(messagePayload.message, AgreementEventV2)
        )
        .otherwise(() => {
          throw genericInternalError(`Unknown topic: ${messagePayload.topic}`);
        });

      const correlationId = decodedMessage.correlation_id || uuidv4();

      const loggerInstance = logger({
        serviceName: "authorization-updater",
        eventType: decodedMessage.type,
        eventVersion: decodedMessage.event_version,
        streamId: decodedMessage.stream_id,
        correlationId,
      });

      await sendAuthUpdate(
        decodedMessage,
        readModelService,
        authService,
        loggerInstance,
        correlationId
      );

      loggerInstance.info(
        `Authorization updated after ${JSON.stringify(
          decodedMessage.type
        )} event - Partition number: ${messagePayload.partition} - Offset: ${
          messagePayload.message.offset
        }`
      );
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
  const authMgmtClient = authorizationManagementClientBuilder(
    config.authorizationManagementUrl
  );
  const tokenGenerator = new InteropTokenGenerator(config);
  const refreshableToken = new RefreshableInteropToken(tokenGenerator);
  await refreshableToken.init();

  const authService = await authorizationServiceBuilder(
    authMgmtClient,
    refreshableToken
  );

  const readModelService = readModelServiceBuilder(
    ReadModelRepository.init(config)
  );
  await runConsumer(
    config,
    [config.catalogTopic, config.agreementTopic],
    processMessage(
      {
        catalogTopic: config.catalogTopic,
      },
      {
        agreementTopic: config.agreementTopic,
      },
      readModelService,
      authService
    )
  );
} catch (e) {
  genericLogger.error(`An error occurred during initialization:\n${e}`);
}
