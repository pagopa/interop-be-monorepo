/* eslint-disable functional/immutable-data */
import {
  AgreementEventEnvelopeV2,
  CorrelationId,
  fromAgreementV2,
  generateId,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import {
  Logger,
  RefreshableInteropToken,
  getInteropHeaders,
} from "pagopa-interop-commons";
import { agreementApi } from "pagopa-interop-api-clients";
import { ContractBuilder } from "../service/agreement/agreementContractBuilder.js";

import {
  getActiveConsumerAndProducerDelegations,
  retrieveEservice,
  retrieveTenant,
} from "../service/agreement/agreementService.js";
import { ReadModelServiceSQL } from "../service/readModelSql.js";
import { PagoPAInteropBeClients } from "../clients/clientProvider.js";

// eslint-disable-next-line max-params
export async function handleAgreementMessageV2(
  decodedMessage: AgreementEventEnvelopeV2,
  readModelService: ReadModelServiceSQL,
  refreshableToken: RefreshableInteropToken,
  agreementContractBuilder: ContractBuilder,
  clients: PagoPAInteropBeClients,
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
        const correlationId = msg.correlation_id
          ? unsafeBrandId<CorrelationId>(msg.correlation_id)
          : generateId<CorrelationId>();
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

        const contract = await agreementContractBuilder.createContract(
          agreement,
          eservice,
          consumer,
          producer,
          activeDelegations
        );

        const contractWithIsoString: agreementApi.Document = {
          ...contract,
          createdAt: contract.createdAt.toISOString(),
        };
        const token = (await refreshableToken.get()).serialized;

        logger.info(
          `Agreement document generated with id ${contractWithIsoString.id}`
        );

        await clients.agreementProcessClient.addUnsignedAgreementContractMetadata(
          contractWithIsoString,
          {
            params: { agreementId: agreement.id },
            headers: getInteropHeaders({
              token,
              correlationId,
            }),
          }
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
          "AgreementRejected",
          "AgreementContractGenerated",
          "AgreementSignedContractGenerated"
        ),
      },
      () => Promise.resolve()
    )
    .exhaustive();
}
