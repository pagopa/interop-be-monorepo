/* eslint-disable sonarjs/no-identical-functions */
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import { decodeKafkaMessage, Logger, logger } from "pagopa-interop-commons";
import {
  AgreementEventV2,
  AttributeEvent,
  AuthorizationEventV2,
  CorrelationId,
  DelegationEventV2,
  EServiceEventV2,
  EventEnvelope,
  generateId,
  genericInternalError,
  NewNotification,
  PurposeEventV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  delegationReadModelServiceBuilder,
  makeDrizzleConnection,
  notificationConfigReadModelServiceBuilder,
  purposeReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { z } from "zod";
import { config } from "./config/config.js";
import {
  readModelServiceBuilderSQL,
  ReadModelServiceSQL,
} from "./services/readModelServiceSQL.js";
import { inAppNotificationServiceBuilderSQL } from "./services/inAppNotificationServiceSQL.js";
import { handleEServiceEvent } from "./handlers/eservices/handleEserviceEvent.js";
import { handleAgreementEvent } from "./handlers/agreements/handleAgreementEvent.js";
import { handlePurposeEvent } from "./handlers/purposes/handlePurposeEvent.js";
import { handleDelegationEvent } from "./handlers/delegations/handleDelegationEvent.js";
import { handleAuthorizationEvent } from "./handlers/authorizations/handleAuthorizationEvent.js";
import { handleAttributeEvent } from "./handlers/attributes/handleAttributeEvent.js";

interface TopicNames {
  catalogTopic: string;
  agreementTopic: string;
  purposeTopic: string;
  delegationTopic: string;
  authorizationTopic: string;
  attributeTopic: string;
}

const readModelDB = makeDrizzleConnection(config);
const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const delegationReadModelServiceSQL =
  delegationReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const notificationConfigReadModelServiceSQL =
  notificationConfigReadModelServiceBuilder(readModelDB);
const purposeReadModelServiceSQL = purposeReadModelServiceBuilder(readModelDB);

const readModelService = readModelServiceBuilderSQL({
  agreementReadModelServiceSQL,
  catalogReadModelServiceSQL,
  delegationReadModelServiceSQL,
  tenantReadModelServiceSQL,
  notificationConfigReadModelServiceSQL,
  purposeReadModelServiceSQL,
});

const notificationDB = drizzle(
  new pg.Pool({
    host: config.inAppNotificationDBHost,
    database: config.inAppNotificationDBName,
    user: config.inAppNotificationDBUsername,
    password: config.inAppNotificationDBPassword,
    port: config.inAppNotificationDBPort,
  })
);

const inAppNotificationService =
  inAppNotificationServiceBuilderSQL(notificationDB);

function processMessage(topicNames: TopicNames) {
  return async (messagePayload: EachMessagePayload): Promise<void> => {
    const {
      catalogTopic,
      agreementTopic,
      purposeTopic,
      delegationTopic,
      authorizationTopic,
      attributeTopic,
    } = topicNames;

    const handleWith = <T extends z.ZodType>(
      eventType: T,
      handler: (
        decodedMessage: EventEnvelope<z.infer<T>>,
        logger: Logger,
        readModelService: ReadModelServiceSQL
      ) => Promise<NewNotification[]>
    ): Promise<NewNotification[]> => {
      const decodedMessage = decodeKafkaMessage(
        messagePayload.message,
        eventType
      );
      const loggerInstance = logger({
        serviceName: "in-app-notification-dispatcher",
        eventType: decodedMessage.type,
        eventVersion: decodedMessage.event_version,
        streamId: decodedMessage.stream_id,
        streamVersion: decodedMessage.version,
        correlationId: decodedMessage.correlation_id
          ? unsafeBrandId<CorrelationId>(decodedMessage.correlation_id)
          : generateId<CorrelationId>(),
      });

      loggerInstance.info(
        `Processing ${decodedMessage.type} message - Partition number: ${messagePayload.partition} - Offset: ${messagePayload.message.offset}`
      );
      return handler(decodedMessage, loggerInstance, readModelService);
    };

    const notifications = await match(messagePayload.topic)
      .with(catalogTopic, async () =>
        handleWith(EServiceEventV2, handleEServiceEvent)
      )
      .with(agreementTopic, async () =>
        handleWith(AgreementEventV2, handleAgreementEvent)
      )
      .with(purposeTopic, async () =>
        handleWith(PurposeEventV2, handlePurposeEvent)
      )
      .with(delegationTopic, async () =>
        handleWith(DelegationEventV2, handleDelegationEvent)
      )
      .with(authorizationTopic, async () =>
        handleWith(AuthorizationEventV2, handleAuthorizationEvent)
      )
      .with(attributeTopic, async () =>
        handleWith(AttributeEvent, handleAttributeEvent)
      )
      .otherwise(() => {
        throw genericInternalError(`Unknown topic: ${messagePayload.topic}`);
      });

    await inAppNotificationService.insertNotifications(notifications);
  };
}

await runConsumer(
  config,
  [
    config.catalogTopic,
    config.agreementTopic,
    config.purposeTopic,
    config.delegationTopic,
    config.authorizationTopic,
    config.attributeTopic,
  ],
  processMessage({
    catalogTopic: config.catalogTopic,
    agreementTopic: config.agreementTopic,
    purposeTopic: config.purposeTopic,
    delegationTopic: config.delegationTopic,
    authorizationTopic: config.authorizationTopic,
    attributeTopic: config.attributeTopic,
  }),
  "in-app-notification-dispatcher"
);
