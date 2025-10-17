/* eslint-disable functional/immutable-data */
import {
  AgreementEventEnvelopeV2,
  fromAgreementV2,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import {
  FileManager,
  Logger,
  PDFGenerator,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { agreementContractBuilder } from "../service/agreement/agreementContractBuilder.js";
import { config } from "../config/config.js";

import {
  getActiveConsumerAndProducerDelegations,
  retrieveEservice,
  retrieveTenant,
} from "../service/agreement/agreementService.js";
import { ReadModelServiceSQL } from "../service/readModelSql.js";

// eslint-disable-next-line max-params
export async function handleAgreementMessageV2(
  decodedMessage: AgreementEventEnvelopeV2,
  pdfGenerator: PDFGenerator,
  fileManager: FileManager,
  readModelService: ReadModelServiceSQL,
  _refreshableToken: RefreshableInteropToken,
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
        const eservice = await retrieveEservice(
          readModelService,
          agreement.eserviceId
        );
        const consumer = await retrieveTenant(
          readModelService,
          agreement.consumerId
        );
        const producer = await retrieveTenant(
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
      () => Promise.resolve()
    )
    .exhaustive();
}
