/* eslint-disable sonarjs/no-identical-functions */
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import { decodeKafkaMessage, Logger, logger } from "pagopa-interop-commons";
import {
  AgreementEvent,
  AttributeEvent,
  AuthorizationEvent,
  CorrelationId,
  DelegationEvent,
  EServiceEvent,
  EServiceTemplateEvent,
  EventEnvelope,
  generateId,
  genericInternalError,
  PurposeEvent,
  TenantEvent,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  catalogReadModelServiceBuilder,
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
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);

const readModelService = readModelServiceBuilderSQL({
  delegationReadModelServiceSQL,
  catalogReadModelServiceSQL,
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

    //     const handleWith = <T extends z.ZodType>(
    //       decodedMessage: EventEnvelope<z.infer<T>>,
    //       handler: (
    //         eventTimestamp: Date,
    //         logger: Logger,
    //         m2mEventWriterService: M2MEventWriterServiceSQL,
    //         readModelService: ReadModelServiceSQL
    //       ) => Promise<void>
    //     ): Promise<void> => {
    //       const loggerInstance = logger({
    //         serviceName: "m2m-event-dispatcher",
    //         eventType: decodedMessage.type,
    //         eventVersion: decodedMessage.event_version,
    //         streamId: decodedMessage.stream_id,
    //         streamVersion: decodedMessage.version,
    //         correlationId: decodedMessage.correlation_id
    //           ? unsafeBrandId<CorrelationId>(decodedMessage.correlation_id)
    //           : generateId<CorrelationId>(),
    //       });

    //       loggerInstance.info(
    //         `Processing ${decodedMessage.type} message - Partition number: ${messagePayload.partition} - Offset: ${messagePayload.message.offset}`
    //       );
    //       return handler(
    //         getEventTimestamp(messagePayload),
    //         loggerInstance,
    //         m2mEventService,
    //         readModelService
    //       );
    //     };

    //     await match(messagePayload.topic)
    //       .with(catalogTopic, async () => {
    //         const decodedMessage = decodeKafkaMessage(
    //           messagePayload.message,
    //           EServiceEvent
    //         )
    //         await match(decodedMessage)
    //           .with(
    //             { event_version: 1 }, () => Promise.resolve() // Skip EServiceEvent v1
    //           )
    //           .with(
    //             { event_version: 2 }, async () =>
    //             handleWith(EServiceEventV2, handleEServiceEvent)
    //           )
    //           .exhaustive();
    //       })

    //       .with(agreementTopic, async () =>
    //         handleWith(AgreementEventV2, handleAgreementEvent)
    //       )
    //   }
    //           .with (purposeTopic, async () =>
    //     handleWith(PurposeEventV2, handlePurposeEvent)
    //   )
    //           .with(delegationTopic, async () =>
    //     handleWith(DelegationEventV2, handleDelegationEvent)
    //   )
    //     .with(authorizationTopic, async () =>
    //       handleWith(AuthorizationEventV2, handleAuthorizationEvent)
    //     )
    //     .with(attributeTopic, async () =>
    //       handleWith(AttributeEvent, handleAttributeEvent)
    //     )
    //     .with(tenantTopic, async () =>
    //       handleWith(TenantEventV2, handleTenantEvent)
    //     )
    //     .with(eserviceTemplateTopic, async () =>
    //       handleWith(EServiceTemplateEventV2, handleEServiceTemplateEvent)
    //     )
    //     .otherwise(() => {
    //       throw genericInternalError(`Unknown topic: ${messagePayload.topic}`);
    //     });
    // };
    // }


    type HandlerContext<T extends z.ZodType> = (
      decodedMessage: EventEnvelope<z.infer<T>>,
      eventTimestamp: Date,
      logger: Logger,
      m2mEventWriterService: M2MEventWriterServiceSQL,
      readModelService: ReadModelServiceSQL
    ) => Promise<void>;

    const handleWith = <T extends z.ZodType>(
      decodedMessage: EventEnvelope<z.infer<T>>,
      handler: HandlerContext<T>,
    ): Promise<void> => {
      const loggerInstance = logger({
        serviceName: 'm2m-event-dispatcher',
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

    const topicEventMap = {
      [catalogTopic]: { schema: EServiceEvent, handler: handleEServiceEvent },
      [agreementTopic]: { schema: AgreementEvent, handler: handleAgreementEvent },
      [purposeTopic]: { schema: PurposeEvent, handler: handlePurposeEvent },
      [delegationTopic]: { schema: DelegationEvent, handler: handleDelegationEvent },
      [authorizationTopic]: { schema: AuthorizationEvent, handler: handleAuthorizationEvent },
      [attributeTopic]: { schema: AttributeEvent, handler: handleAttributeEvent },
      [tenantTopic]: { schema: TenantEvent, handler: handleTenantEvent },
      [eserviceTemplateTopic]: { schema: EServiceTemplateEvent, handler: handleEServiceTemplateEvent },
    };

    const eventConfig = topicEventMap[messagePayload.topic];

    if (!eventConfig) {
      throw genericInternalError(`Unknown topic: ${messagePayload.topic}`);
    }

    const { schema, handler } = eventConfig;

    const decodedMessage = decodeKafkaMessage(messagePayload.message, schema);

    if (decodedMessage.event_version === 1) {
      return Promise.resolve();
    }

    return handleWith(decodedMessage, handler);
  };
};

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
