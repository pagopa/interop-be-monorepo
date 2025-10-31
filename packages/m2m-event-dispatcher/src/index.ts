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
  EServiceTemplateEventV2,
  EventEnvelope,
  generateId,
  genericInternalError,
  PurposeEventV2,
  TenantEventV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  delegationReadModelServiceBuilder,
  makeDrizzleConnection,
} from "pagopa-interop-readmodel";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { z } from "zod";
import { config } from "./config/config.js";
import {
  readModelServiceBuilderSQL,
  ReadModelServiceSQL,
} from "./services/readModelServiceSQL.js";
import {
  M2MEventWriterServiceSQL,
  m2mEventWriterServiceSQLBuilder,
} from "./services/m2mEventWriterServiceSQL.js";
import { handleAgreementEvent } from "./handlers/handleAgreementEvent.js";
import { handlePurposeEvent } from "./handlers/handlePurposeEvent.js";
import { handleDelegationEvent } from "./handlers/handleDelegationEvent.js";
import { handleAuthorizationEvent } from "./handlers/handleAuthorizationEvent.js";
import { handleAttributeEvent } from "./handlers/handleAttributeEvent.js";
import { handleEServiceEvent } from "./handlers/handleEServiceEvent.js";
import { handleTenantEvent } from "./handlers/handleTenantEvent.js";
import { handleEServiceTemplateEvent } from "./handlers/handleEServiceTemplateEvent.js";
import { getEventTimestamp } from "./utils/eventTimestamp.js";

interface TopicNames {
  catalogTopic: string;
  agreementTopic: string;
  purposeTopic: string;
  delegationTopic: string;
  authorizationTopic: string;
  attributeTopic: string;
  tenantTopic: string;
  eserviceTemplateTopic: string;
}

const readModelDB = makeDrizzleConnection(config);
const delegationReadModelServiceSQL =
  delegationReadModelServiceBuilder(readModelDB);

const readModelService = readModelServiceBuilderSQL({
  delegationReadModelServiceSQL,
});

const m2mEventDB = drizzle(
  new pg.Pool({
    host: config.m2mEventSQLDbHost,
    database: config.m2mEventSQLDbName,
    user: config.m2mEventSQLDbUsername,
    password: config.m2mEventSQLDbPassword,
    port: config.m2mEventSQLDbPort,
    ssl: config.m2mEventSQLDbUseSSL ? { rejectUnauthorized: false } : undefined,
  })
);

const m2mEventService = m2mEventWriterServiceSQLBuilder(m2mEventDB);

function processMessage(topicNames: TopicNames) {
  return async (messagePayload: EachMessagePayload): Promise<void> => {
    const {
      catalogTopic,
      agreementTopic,
      purposeTopic,
      delegationTopic,
      authorizationTopic,
      attributeTopic,
      tenantTopic,
      eserviceTemplateTopic,
    } = topicNames;

    const handleWith = <T extends z.ZodType>(
      eventType: T,
      handler: (
        decodedMessage: EventEnvelope<z.infer<T>>,
        eventTimestamp: Date,
        logger: Logger,
        m2mEventWriterService: M2MEventWriterServiceSQL,
        readModelService: ReadModelServiceSQL
      ) => Promise<void>
    ): Promise<void> => {
      const decodedMessage = decodeKafkaMessage(
        messagePayload.message,
        eventType
      );
      const loggerInstance = logger({
        serviceName: "m2m-event-dispatcher",
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
      return handler(
        decodedMessage,
        getEventTimestamp(messagePayload),
        loggerInstance,
        m2mEventService,
        readModelService
      );
    };

    await match(messagePayload.topic)
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
      .with(tenantTopic, async () =>
        handleWith(TenantEventV2, handleTenantEvent)
      )
      .with(eserviceTemplateTopic, async () =>
        handleWith(EServiceTemplateEventV2, handleEServiceTemplateEvent)
      )
      .otherwise(() => {
        throw genericInternalError(`Unknown topic: ${messagePayload.topic}`);
      });
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
    tenantTopic: config.tenantTopic,
    eserviceTemplateTopic: config.eserviceTemplateTopic,
  }),
  "m2m-event-dispatcher"
);
