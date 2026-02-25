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
  EmailNotificationMessagePayload,
  TenantEvent,
  EServiceTemplateEventV2,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  attributeReadModelServiceBuilder,
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  makeDrizzleConnection,
  tenantReadModelServiceBuilder,
  notificationConfigReadModelServiceBuilder,
  purposeReadModelServiceBuilder,
  delegationReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { z } from "zod";
import { config } from "./config/config.js";
import { emailNotificationDispatcherServiceBuilder } from "./services/emailNotificationDispatcherService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
import { handleEServiceEvent } from "./handlers/eservices/handleEserviceEvent.js";
import { handleAgreementEvent } from "./handlers/agreements/handleAgreementEvent.js";
import { handleDelegationEvent } from "./handlers/delegations/handleDelegationEvent.js";
import { handlePurposeEvent } from "./handlers/purposes/handlePurposeEvent.js";
import { HandlerParams } from "./models/handlerParams.js";
import { handleTenantEvent } from "./handlers/tenants/handleTenantEvent.js";
import { handleAuthorizationEvent } from "./handlers/authorization/handleAuthorizationEvent.js";
import { handleEServiceTemplateEvent } from "./handlers/eserviceTemplates/handleEserviceTemplatesEvent.js";

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

const readModelService = readModelServiceBuilderSQL({
  readModelDB,
  agreementReadModelServiceSQL,
  attributeReadModelServiceSQL,
  catalogReadModelServiceSQL,
  delegationReadModelServiceSQL,
  tenantReadModelServiceSQL,
  notificationConfigReadModelServiceSQL,
  purposeReadModelServiceSQL,
});

const emailNotificationDispatcherService =
  emailNotificationDispatcherServiceBuilder();

const templateService = buildHTMLTemplateService();

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
function registerPartial(name: string, path: string): void {
  const buffer = fs.readFileSync(`${dirname}/${path}`);
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
      tenantTopic,
      eserviceTemplateTopic,
    } = topicHandlers;

    const handleWith = <T extends z.ZodType>(
      eventType: T,
      handler: (
        params: HandlerParams<T>
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

      return handler({
        decodedMessage,
        correlationId,
        logger: loggerInstance,
        readModelService,
        templateService,
      });
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
      .with(tenantTopic, async () => handleWith(TenantEvent, handleTenantEvent))
      .with(eserviceTemplateTopic, async () =>
        handleWith(EServiceTemplateEventV2, handleEServiceTemplateEvent)
      )
      .otherwise(() => {
        throw genericInternalError(`Unknown topic: ${messagePayload.topic}`);
      });

    await emailNotificationDispatcherService.sendMessages(
      emailNotificationPayloads
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
  })
);
