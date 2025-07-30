/* eslint-disable sonarjs/no-identical-functions */
import { fileURLToPath } from "url";
import fs from "fs";
import path from "path";
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  buildHTMLTemplateService,
  decodeKafkaMessage,
  HtmlTemplateService,
  Logger,
  logger,
} from "pagopa-interop-commons";
import {
  AgreementEventV2,
  CorrelationId,
  EServiceEventV2,
  DelegationEventV2,
  generateId,
  genericInternalError,
  PurposeEventV2,
  unsafeBrandId,
  AuthorizationEventV2,
  AttributeEvent,
  EventEnvelope,
  EmailNotificationMessagePayload,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  makeDrizzleConnection,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { z } from "zod";
import { config } from "./config/config.js";
import { emailNotificationDispatcherServiceBuilder } from "./services/emailNotificationDispatcherService.js";
import {
  readModelServiceBuilderSQL,
  ReadModelServiceSQL,
} from "./services/readModelServiceSQL.js";
import { handleEServiceEvent } from "./handlers/eservices/handleEserviceEvent.js";
import { handleAgreementEvent } from "./handlers/agreements/handleAgreementEvent.js";
import { handleAttributeEvent } from "./handlers/attributes/handleAttributeEvent.js";
import { handleAuthorizationEvent } from "./handlers/authorization/handleAuthorizationEvent.js";
import { handleDelegationEvent } from "./handlers/delegations/handleDelegationEvent.js";
import { handlePurposeEvent } from "./handlers/purposes/handlePurposeEvent.js";

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
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);

const readModelService = readModelServiceBuilderSQL({
  agreementReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
});

const emailNotificationDispatcherService =
  emailNotificationDispatcherServiceBuilder();

const templateService = buildHTMLTemplateService();

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
function registerPartial(name: string, path: string): void {
  const buffer = fs.readFileSync(`${dirname}/..${path}`);
  templateService.registerPartial(name, buffer.toString());
}

registerPartial(
  "common-header",
  "/resources/templates/headers/common-header.hbs"
);
registerPartial(
  "common-footer",
  "/resources/templates/footers/common-footer.hbs"
);

function processMessage(topicHandlers: TopicNames) {
  return async (messagePayload: EachMessagePayload): Promise<void> => {
    const {
      catalogTopic,
      agreementTopic,
      purposeTopic,
      delegationTopic,
      authorizationTopic,
      attributeTopic,
    } = topicHandlers;

    const handleWith = <T extends z.ZodType>(
      eventType: T,
      handler: (
        decodedMessage: EventEnvelope<z.infer<T>>,
        correlationId: CorrelationId,
        loggerInstance: Logger,
        readModelService: ReadModelServiceSQL,
        templateService: HtmlTemplateService
      ) => Promise<EmailNotificationMessagePayload[]>
    ): Promise<EmailNotificationMessagePayload[]> => {
      const decodedMessage = decodeKafkaMessage(
        messagePayload.message,
        eventType
      );
      const correlationId = decodedMessage.correlation_id
        ? unsafeBrandId<CorrelationId>(decodedMessage.correlation_id)
        : generateId<CorrelationId>();
      const loggerInstance = logger({
        serviceName: "email-notification-dispatcher",
        eventType: decodedMessage.type,
        eventVersion: decodedMessage.event_version,
        streamId: decodedMessage.stream_id,
        streamVersion: decodedMessage.version,
        correlationId,
      });

      loggerInstance.info(
        `Processing ${decodedMessage.type} message - Partition number: ${messagePayload.partition} - Offset: ${messagePayload.message.offset}`
      );

      return handler(
        decodedMessage,
        correlationId,
        loggerInstance,
        readModelService,
        templateService
      );
    };

    const emailNotificationPayloads = await match(messagePayload.topic)
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

    emailNotificationPayloads.forEach((messagePayload) =>
      emailNotificationDispatcherService.sendMessage(messagePayload)
    );
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
  })
);
