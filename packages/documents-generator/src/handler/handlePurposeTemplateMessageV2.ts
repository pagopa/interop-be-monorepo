/* eslint-disable functional/immutable-data */
import {
  CorrelationId,
  PurposeTemplate,
  PurposeTemplateEventEnvelopeV2,
  RiskAnalysisTemplateDocument,
  fromPurposeTemplateV2,
  generateId,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import {
  FileManager,
  Logger,
  PDFGenerator,
  RefreshableInteropToken,
  getInteropHeaders,
  getIpaCode,
} from "pagopa-interop-commons";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { ReadModelServiceSQL } from "../service/readModelSql.js";
import { PagoPAInteropBeClients } from "../clients/clientProvider.js";
import { riskAnalysisTemplateDocumentBuilder } from "../service/purpose-template/purposeTemplateDocumentBuilder.js";
import { config } from "../config/config.js";
import { retrieveTenant } from "../service/purpose/purposeService.js";

// eslint-disable-next-line max-params
export async function handlePurposeTemplateMessageV2(
  decodedMessage: PurposeTemplateEventEnvelopeV2,
  pdfGenerator: PDFGenerator,
  fileManager: FileManager,
  readModelService: ReadModelServiceSQL,
  refreshableToken: RefreshableInteropToken,
  clients: PagoPAInteropBeClients,
  logger: Logger
): Promise<void> {
  await match(decodedMessage)
    .with(
      {
        type: P.union("PurposeTemplatePublished"),
      },
      async (msg): Promise<void> => {
        const correlationId = msg.correlation_id
          ? unsafeBrandId<CorrelationId>(msg.correlation_id)
          : generateId<CorrelationId>();

        if (!msg.data.purposeTemplate) {
          throw missingKafkaMessageDataError("purposeTemplate", msg.type);
        }
        const purposeTemplate = fromPurposeTemplateV2(msg.data.purposeTemplate);

        const tenant = await retrieveTenant(
          purposeTemplate.creatorId,
          readModelService
        );
        const contract = await riskAnalysisTemplateDocumentBuilder(
          pdfGenerator,
          fileManager,
          config,
          logger
        ).createRiskAnalysisTemplateDocument(
          purposeTemplate,
          tenant.name,
          getIpaCode(tenant),
          purposeTemplate.targetTenantKind,
          "it",
          msg.log_date
        );

        await sendContractMetadataToProcess(
          contract,
          refreshableToken,
          purposeTemplate,
          correlationId,
          clients,
          logger
        );
        logger.info(`Purpose template event ${msg.type} handled successfully`);
      }
    )
    .with(
      {
        type: P.union(
          "PurposeTemplateAdded",
          "PurposeTemplateAnnotationDocumentAdded",
          "PurposeTemplateAnnotationDocumentDeleted",
          "PurposeTemplateAnnotationDocumentUpdated",
          "PurposeTemplateArchived",
          "PurposeTemplateDraftDeleted",
          "PurposeTemplateDraftUpdated",
          "PurposeTemplateEServiceLinked",
          "PurposeTemplateEServiceUnlinked",
          "PurposeTemplateSuspended",
          "PurposeTemplateUnsuspended",
          "RiskAnalysisTemplateDocumentGenerated",
          "RiskAnalysisTemplateSignedDocumentGenerated"
        ),
      },
      () => Promise.resolve()
    )
    .exhaustive();
}

// eslint-disable-next-line max-params
async function sendContractMetadataToProcess(
  contract: RiskAnalysisTemplateDocument,
  refreshableToken: RefreshableInteropToken,
  purposeTemplate: PurposeTemplate,
  correlationId: CorrelationId,
  clients: PagoPAInteropBeClients,
  logger: Logger
): Promise<void> {
  const contractWithIsoString: purposeTemplateApi.RiskAnalysisTemplateDocument =
    {
      ...contract,
      createdAt: contract.createdAt.toISOString(),
    };
  const token = (await refreshableToken.get()).serialized;

  logger.info(
    `purpose template document generated with id ${contractWithIsoString.id}`
  );

  await clients.purposeTemplateProcessClient.internalAddRiskAnalysisTemplateDocumentMetadata(
    contractWithIsoString,
    {
      params: { purposeTemplateId: purposeTemplate.id },
      headers: getInteropHeaders({
        token,
        correlationId,
      }),
    }
  );
}
