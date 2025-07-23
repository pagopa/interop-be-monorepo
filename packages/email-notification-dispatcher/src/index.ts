/* eslint-disable sonarjs/no-identical-functions */
import { fileURLToPath } from "url";
import fs from "fs";
import path from "path";
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  buildHTMLTemplateService,
  decodeKafkaMessage,
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
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  makeDrizzleConnection,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { emailNotificationDispatcherServiceBuilder } from "./services/emailNotificationDispatcherService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
import { handleEvent } from "./handlers/eventHandler.js";

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

    const eventType = match(messagePayload.topic)
      .with(catalogTopic, () => EServiceEventV2)
      .with(agreementTopic, () => AgreementEventV2)
      .with(purposeTopic, () => PurposeEventV2)
      .with(delegationTopic, () => DelegationEventV2)
      .with(authorizationTopic, () => AuthorizationEventV2)
      .with(attributeTopic, () => AttributeEvent)
      .otherwise(() => {
        throw genericInternalError(`Unknown topic: ${messagePayload.topic}`);
      });

    const decodedMessage = decodeKafkaMessage(
      messagePayload.message,
      eventType
    );

    const loggerInstance = logger({
      serviceName: "email-notification-dispatcher",
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

    const emailNotificationMessagePayloads = await handleEvent(
      decodedMessage,
      loggerInstance,
      readModelService,
      templateService
    );

    emailNotificationMessagePayloads.forEach((messagePayload) =>
      emailNotificationDispatcherService.sendMessage(
        decodedMessage.stream_id,
        messagePayload
      )
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
