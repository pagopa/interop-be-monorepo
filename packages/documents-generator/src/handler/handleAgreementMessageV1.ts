/* eslint-disable functional/immutable-data */
import {
  AgreementEventEnvelopeV1,
  CorrelationId,
  agreementState,
  fromAgreementV1,
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
} from "pagopa-interop-commons";
import { agreementApi } from "pagopa-interop-api-clients";
import { agreementContractBuilder } from "../service/agreement/agreementContractBuilder.js";
import { config } from "../config/config.js";

import {
  getActiveConsumerAndProducerDelegations,
  retrieveEservice,
  retrieveTenant,
} from "../service/agreement/agreementService.js";
import { ReadModelServiceSQL } from "../service/readModelSql.js";
import { PagoPAInteropBeClients } from "../clients/clientProvider.js";

// eslint-disable-next-line max-params
export async function handleAgreementMessageV1(
  decodedMessage: AgreementEventEnvelopeV1,
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

        const contract = await agreementContractBuilder(
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
