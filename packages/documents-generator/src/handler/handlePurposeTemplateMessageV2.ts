/* eslint-disable functional/immutable-data */
import {
  CorrelationId,
  Delegation,
  DelegationContractDocument,
  PurposeTemplateEventEnvelopeV2,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import {
  FileManager,
  Logger,
  PDFGenerator,
  RefreshableInteropToken,
  getInteropHeaders,
} from "pagopa-interop-commons";
import { delegationApi } from "pagopa-interop-api-clients";
import { ReadModelServiceSQL } from "../service/readModelSql.js";
import { PagoPAInteropBeClients } from "../clients/clientProvider.js";

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
          "PurposeTemplateUnsuspended"
        ),
      },
      () => Promise.resolve()
    )
    .exhaustive();
}

// eslint-disable-next-line max-params
async function sendContractMetadataToProcess(
  contract: DelegationContractDocument,
  refreshableToken: RefreshableInteropToken,
  delegation: Delegation,
  correlationId: CorrelationId,
  clients: PagoPAInteropBeClients,
  logger: Logger
): Promise<void> {
  const contractWithIsoString: delegationApi.DelegationContractDocument = {
    ...contract,
    createdAt: contract.createdAt.toISOString(),
  };
  const token = (await refreshableToken.get()).serialized;
  logger.info(
    `delegation document generated with id ${contractWithIsoString.id}`
  );
  await clients.delegationProcessClient.delegation.addUnsignedDelegationContractMetadata(
    contractWithIsoString,
    {
      params: { delegationId: delegation.id },
      headers: getInteropHeaders({
        token,
        correlationId,
      }),
    }
  );
}
