/* eslint-disable sonarjs/no-identical-functions */
import { drizzle } from "drizzle-orm/node-postgres";
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import { decodeKafkaMessage, Logger, logger } from "pagopa-interop-commons";
import {
  AgreementEvent,
  AuthorizationEvent,
  CorrelationId,
  DelegationEventV2,
  EServiceEvent,
  EServiceTemplateEventV2,
  EventEnvelope,
  NewNotification,
  NotificationType,
  PurposeEvent,
  TenantEvent,
  generateId,
  genericInternalError,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  agreementReadModelServiceBuilder,
  attributeReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  delegationReadModelServiceBuilder,
  makeDrizzleConnection,
  notificationConfigReadModelServiceBuilder,
  producerKeychainReadModelServiceBuilder,
  purposeReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import pg from "pg";
import { match } from "ts-pattern";
import { z } from "zod";

import { config } from "./config/config.js";
import { handleAgreementEvent } from "./handlers/agreements/handleAgreementEvent.js";
import { handleAuthorizationEvent } from "./handlers/authorizations/handleAuthorizationEvent.js";
import { handleDelegationEvent } from "./handlers/delegations/handleDelegationEvent.js";
import { handleEServiceEvent } from "./handlers/eservices/handleEserviceEvent.js";
import { handleEServiceTemplateEvent } from "./handlers/eserviceTemplates/handleEserviceTemplatesEvent.js";
import { handlePurposeEvent } from "./handlers/purposes/handlePurposeEvent.js";
import { handleTenantEvent } from "./handlers/tenants/handleTenantEvent.js";
import { inAppNotificationServiceBuilderSQL } from "./services/inAppNotificationServiceSQL.js";
import {
  readModelServiceBuilderSQL,
  ReadModelServiceSQL,
} from "./services/readModelServiceSQL.js";

interface TopicNames {
  catalogTopic: string;
  agreementTopic: string;
  purposeTopic: string;
  delegationTopic: string;
  authorizationTopic: string;
  tenantTopic: string;
  eserviceTemplateTopic: string;
}

const readModelDB = makeDrizzleConnection(config);
const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
const attributeReadModelServiceSQL =
  attributeReadModelServiceBuilder(readModelDB);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const delegationReadModelServiceSQL =
  delegationReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const notificationConfigReadModelServiceSQL =
  notificationConfigReadModelServiceBuilder(readModelDB);
const purposeReadModelServiceSQL = purposeReadModelServiceBuilder(readModelDB);
const producerKeychainReadModelServiceSQL =
  producerKeychainReadModelServiceBuilder(readModelDB);

const readModelService = readModelServiceBuilderSQL({
  agreementReadModelServiceSQL,
  attributeReadModelServiceSQL,
  catalogReadModelServiceSQL,
  delegationReadModelServiceSQL,
  tenantReadModelServiceSQL,
  notificationConfigReadModelServiceSQL,
  purposeReadModelServiceSQL,
  notificationTypeBlocklist:
    config.notificationTypeBlocklist as NotificationType[],
  producerKeychainReadModelServiceSQL,
});

const notificationDB = drizzle(
  new pg.Pool({
    host: config.inAppNotificationDBHost,
    database: config.inAppNotificationDBName,
    user: config.inAppNotificationDBUsername,
    password: config.inAppNotificationDBPassword,
    port: config.inAppNotificationDBPort,
    ssl: config.inAppNotificationDBUseSSL
      ? { rejectUnauthorized: false }
      : undefined,
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
      tenantTopic,
      eserviceTemplateTopic,
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
        handleWith(EServiceEvent, handleEServiceEvent)
      )
      .with(agreementTopic, async () =>
        handleWith(AgreementEvent, handleAgreementEvent)
      )
      .with(purposeTopic, async () =>
        handleWith(PurposeEvent, handlePurposeEvent)
      )
      .with(delegationTopic, async () =>
        handleWith(DelegationEventV2, handleDelegationEvent)
      )
      .with(authorizationTopic, async () =>
        handleWith(AuthorizationEvent, handleAuthorizationEvent)
      )
      .with(tenantTopic, async () => handleWith(TenantEvent, handleTenantEvent))
      .with(eserviceTemplateTopic, async () =>
        handleWith(EServiceTemplateEventV2, handleEServiceTemplateEvent)
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
    config.tenantTopic,
    config.eserviceTemplateTopic,
  ],
  processMessage({
    catalogTopic: config.catalogTopic,
    agreementTopic: config.agreementTopic,
    purposeTopic: config.purposeTopic,
    delegationTopic: config.delegationTopic,
    authorizationTopic: config.authorizationTopic,
    tenantTopic: config.tenantTopic,
    eserviceTemplateTopic: config.eserviceTemplateTopic,
  }),
  config.featureFlagConfluentKafka,
  "in-app-notification-dispatcher"
);
