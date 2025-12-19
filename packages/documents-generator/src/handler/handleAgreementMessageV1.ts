/* eslint-disable functional/immutable-data */
import {
  AgreementEventEnvelopeV1,
  AgreementStamp,
  AgreementStamps,
  CorrelationId,
  agreementState,
  fromAgreementV1,
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

import {
  getActiveConsumerAndProducerDelegations,
  retrieveEservice,
  retrieveTenant,
} from "../service/agreement/agreementService.js";
import { ReadModelServiceSQL } from "../service/readModelSql.js";
import { PagoPAInteropBeClients } from "../clients/clientProvider.js";
import { ContractBuilder } from "../service/agreement/agreementContractBuilder.js";

// eslint-disable-next-line max-params
export async function handleAgreementMessageV1(
  decodedMessage: AgreementEventEnvelopeV1,
  readModelService: ReadModelServiceSQL,
  refreshableToken: RefreshableInteropToken,
  agreementContractBuilder: ContractBuilder,
  clients: PagoPAInteropBeClients,
  logger: Logger
): Promise<void> {
  await match(decodedMessage)
    .with(
      {
        type: P.union("AgreementActivated", "AgreementUpdated"),
      },
      async (msg): Promise<void> => {
        if (!msg.data.agreement) {
          throw missingKafkaMessageDataError("agreement", msg.type);
        }
        const correlationId = msg.correlation_id
          ? unsafeBrandId<CorrelationId>(msg.correlation_id)
          : generateId<CorrelationId>();
        const agreement = fromAgreementV1(msg.data.agreement);

        if (agreement.state !== agreementState.active) {
          logger.info(`Agreement ${agreement.id} state not active `);
          return;
        }

        if (
          !hasStamp(agreement.stamps, "submission") ||
          !hasStamp(agreement.stamps, "activation")
        ) {
          logger.info(
            `Skipping agreement ${agreement.id}: missing submission or activation stamps`
          );
          return;
        }

        const [eservice, consumer, producer, activeDelegations] =
          await Promise.all([
            retrieveEservice(readModelService, agreement.eserviceId),
            retrieveTenant(readModelService, agreement.consumerId),
            retrieveTenant(readModelService, agreement.producerId),
            getActiveConsumerAndProducerDelegations(
              agreement,
              readModelService
            ),
          ]);

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
          "AgreementSuspended",
          "AgreementDeactivated",
          "VerifiedAttributeUpdated",
          "AgreementConsumerDocumentAdded",
          "AgreementConsumerDocumentRemoved",
          "AgreementContractAdded"
        ),
      },
      () => Promise.resolve()
    )
    .exhaustive();
}

function hasStamp<S extends keyof AgreementStamps>(
  stamps: AgreementStamps | undefined,
  stamp: S
): stamps is AgreementStamps & { [key in S]: AgreementStamp } {
  return !!stamps && !!stamps[stamp];
}
