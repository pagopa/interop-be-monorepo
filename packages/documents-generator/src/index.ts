/* eslint-disable functional/immutable-data */
import {
  genericLogger,
  initFileManager,
  initPDFGenerator,
} from "pagopa-interop-commons";
import {
  getMockPurposeTemplate,
  getMockTenant,
  getMockCompleteRiskAnalysisFormTemplate,
} from "pagopa-interop-commons-test";
import { tenantKind } from "pagopa-interop-models";

import { config } from "./config/config.js";
import { riskAnalysisTemplateDocumentBuilder } from "./service/purpose-template/purposeTemplateDocumentBuilder.js";

// Mock data for testing - using getMockCompleteRiskAnalysisFormTemplate which includes annotations with docs
const purposeTemplate = {
  ...getMockPurposeTemplate(),
  purposeRiskAnalysisForm: getMockCompleteRiskAnalysisFormTemplate(
    tenantKind.PA
  ),
  targetTenantKind: tenantKind.PA,
};

const tenant = {
  ...getMockTenant(),
  externalId: {
    origin: "IPA",
    value: "ipa_code_123",
  },
};

const getIpaCode = (t: typeof tenant): string | undefined =>
  t.externalId.origin === "IPA" ? t.externalId.value : undefined;

const msg = {
  log_date: new Date(),
};

const fileManager = initFileManager(config);
const pdfGenerator = await initPDFGenerator();

await riskAnalysisTemplateDocumentBuilder(
  pdfGenerator,
  fileManager,
  config,
  genericLogger
).createRiskAnalysisTemplateDocument(
  purposeTemplate,
  tenant.name,
  getIpaCode(tenant),
  purposeTemplate.targetTenantKind,
  "it",
  msg.log_date
);

genericLogger.info("Done!");

// function processMessage(
//   agreementTopicConfig: AgreementTopicConfig,
//   purposeTopicConfig: PurposeTopicConfig,
//   delegationTopicConfig: DelegationTopicConfig,
//   purposeTemplateTopicConfig: PurposeTemplateTopicConfig
// ) {
//   return async (messagePayload: EachMessagePayload): Promise<void> => {
//     const { decodedMessage, documentGenerator } = match(messagePayload.topic)
//       .with(agreementTopicConfig.agreementTopic, () => {
//         const decodedMessage = decodeKafkaMessage(
//           messagePayload.message,
//           AgreementEvent
//         );

//         const documentGenerator = match(decodedMessage)
//           .with({ event_version: 1 }, (decoded) =>
//             handleAgreementMessageV1.bind(
//               null,
//               decoded,
//               readModelServiceSQL,
//               refreshableToken,
//               agreementContractInstance
//             )
//           )
//           .with({ event_version: 2 }, (decoded) =>
//             handleAgreementMessageV2.bind(
//               null,
//               decoded,
//               readModelServiceSQL,
//               refreshableToken,
//               agreementContractInstance
//             )
//           )
//           .exhaustive();

//         return { decodedMessage, documentGenerator };
//       })
//       .with(purposeTopicConfig.purposeTopic, () => {
//         const decodedMessage = decodeKafkaMessage(
//           messagePayload.message,
//           PurposeEvent
//         );

//         const documentGenerator = match(decodedMessage)
//           .with({ event_version: 1 }, (decoded) =>
//             handlePurposeMessageV1.bind(
//               null,
//               decoded,
//               readModelServiceSQL,
//               refreshableToken,
//               riskAnalysisContractInstance
//             )
//           )
//           .with({ event_version: 2 }, (decoded) =>
//             handlePurposeMessageV2.bind(
//               null,
//               decoded,
//               readModelServiceSQL,
//               refreshableToken,
//               riskAnalysisContractInstance
//             )
//           )
//           .exhaustive();

//         return { decodedMessage, documentGenerator };
//       })
//       .with(delegationTopicConfig.delegationTopic, () => {
//         const decodedMessage = decodeKafkaMessage(
//           messagePayload.message,
//           DelegationEventV2
//         );

//         const documentGenerator = handleDelegationMessageV2.bind(
//           null,
//           decodedMessage,
//           pdfGenerator,
//           fileManager,
//           readModelServiceSQL,
//           refreshableToken
//         );

//         return { decodedMessage, documentGenerator };
//       })
//       .with(purposeTemplateTopicConfig.purposeTemplateTopic, () => {
//         const decodedMessage = decodeKafkaMessage(
//           messagePayload.message,
//           PurposeTemplateEventV2
//         );

//         const documentGenerator = handlePurposeTemplateMessageV2.bind(
//           null,
//           decodedMessage,
//           pdfGenerator,
//           fileManager,
//           readModelServiceSQL,
//           refreshableToken
//         );

//         return { decodedMessage, documentGenerator };
//       })
//       .otherwise(() => {
//         throw genericInternalError(`Unknown topic: ${messagePayload.topic}`);
//       });

//     const correlationId: CorrelationId = decodedMessage.correlation_id
//       ? unsafeBrandId(decodedMessage.correlation_id)
//       : generateId();

//     const loggerInstance = logger({
//       serviceName: "documents-generator",
//       eventType: decodedMessage.type,
//       eventVersion: decodedMessage.event_version,
//       streamId: decodedMessage.stream_id,
//       streamVersion: decodedMessage.version,
//       correlationId,
//     });

//     loggerInstance.info(
//       `Processing ${decodedMessage.type} message - Partition number: ${messagePayload.partition} - Offset: ${messagePayload.message.offset}`
//     );

//     await documentGenerator(clients, loggerInstance);
//   };
// }

// await runConsumer(
//   baseConsumerConfig,
//   [
//     config.agreementTopic,
//     config.purposeTopic,
//     config.delegationTopic,
//     config.purposeTemplateTopic,
//   ],
//   processMessage(
//     {
//       agreementTopic: config.agreementTopic,
//     },
//     {
//       purposeTopic: config.purposeTopic,
//     },
//     {
//       delegationTopic: config.delegationTopic,
//     },
//     {
//       purposeTemplateTopic: config.purposeTemplateTopic,
//     }
//   )
// );
