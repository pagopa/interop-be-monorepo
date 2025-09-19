/* eslint-disable functional/immutable-data */
import {
  AgreementEventEnvelopeV2,
  fromAgreementV2,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { FileManager, Logger, PDFGenerator } from "pagopa-interop-commons";
import { ReadModelService } from "../service/readModelService.js";
import { agreementContractBuilder } from "../service/agreement/agreementContractBuilder.js";
import { config } from "../config/config.js";
import {
  retrieveEserviceById,
  retrieveTenantById,
} from "../service/delegation/delegationService.js";
import { getActiveConsumerAndProducerDelegations } from "../service/agreement/agreementService.js";

export async function handleAgreementMessageV2(
  decodedMessage: AgreementEventEnvelopeV2,
  pdfGenerator: PDFGenerator,
  fileManager: FileManager,
  readModelService: ReadModelService,
  logger: Logger
): Promise<void> {
  await match(decodedMessage)
    .with(
      {
        type: P.union("AgreementActivated", "AgreementUpgraded"),
      },
      async (msg): Promise<void> => {
        if (!msg.data.agreement) {
          throw missingKafkaMessageDataError("agreement", msg.type);
        }
        const agreement = fromAgreementV2(msg.data.agreement);
        const eservice = await retrieveEserviceById(
          readModelService,
          agreement.eserviceId
        );
        const consumer = await retrieveTenantById(
          readModelService,
          agreement.consumerId
        );
        const producer = await retrieveTenantById(
          readModelService,
          agreement.producerId
        );
        const activeDelegations = await getActiveConsumerAndProducerDelegations(
          agreement,
          readModelService
        );

        await agreementContractBuilder(
          readModelService,
          pdfGenerator,
          fileManager,
          config,
          logger
        ).createContract(
          agreement,
          eservice,
          consumer,
          producer,
          activeDelegations
        );
        logger.info(`Agreement event ${msg.type} handled successfully`);
      }
    )
    .with(
      {
        type: P.union(
          "AgreementAdded",
          "AgreementDeleted",
          "DraftAgreementUpdated",
          "AgreementArchivedByUpgrade",
          "AgreementConsumerDocumentAdded",
          "AgreementConsumerDocumentRemoved",
          "AgreementSetDraftByPlatform",
          "AgreementSetMissingCertifiedAttributesByPlatform",
          "AgreementDeletedByRevokedDelegation",
          "AgreementArchivedByRevokedDelegation",
          "AgreementSubmitted",
          "AgreementUnsuspendedByProducer",
          "AgreementUnsuspendedByConsumer",
          "AgreementUnsuspendedByPlatform",
          "AgreementArchivedByConsumer",
          "AgreementSuspendedByProducer",
          "AgreementSuspendedByConsumer",
          "AgreementSuspendedByPlatform",
          "AgreementRejected"
        ),
      },
      () => {
        logger.info(
          `No document generation needed for ${decodedMessage.type} message`
        );
      }
    )
    .exhaustive();
}
