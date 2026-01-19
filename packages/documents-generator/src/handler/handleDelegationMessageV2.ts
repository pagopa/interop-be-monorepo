/* eslint-disable functional/immutable-data */
import {
  CorrelationId,
  Delegation,
  DelegationContractDocument,
  DelegationEventEnvelopeV2,
  fromDelegationV2,
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
import { delegationApi } from "pagopa-interop-api-clients";
import { contractBuilder } from "../service/delegation/delegationContractBuilder.js";
import { config } from "../config/config.js";
import {
  retrieveTenantById,
  retrieveEserviceById,
} from "../service/delegation/delegationService.js";
import { ReadModelServiceSQL } from "../service/readModelSql.js";
import { PagoPAInteropBeClients } from "../clients/clientProvider.js";

// eslint-disable-next-line max-params
export async function handleDelegationMessageV2(
  decodedMessage: DelegationEventEnvelopeV2,
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
        type: P.union(
          "ProducerDelegationApproved",
          "ConsumerDelegationApproved"
        ),
      },
      async (msg): Promise<void> => {
        if (!msg.data.delegation) {
          throw missingKafkaMessageDataError("delegation", msg.type);
        }
        const correlationId = msg.correlation_id
          ? unsafeBrandId<CorrelationId>(msg.correlation_id)
          : generateId<CorrelationId>();

        const delegation = fromDelegationV2(msg.data.delegation);
        const messageTimestamp = msg.log_date;
        const [delegator, delegate, eservice] = await Promise.all([
          retrieveTenantById(readModelService, delegation.delegatorId),
          retrieveTenantById(readModelService, delegation.delegateId),
          retrieveEserviceById(readModelService, delegation.eserviceId),
        ]);

        if (!delegator || !delegate || !eservice) {
          throw new Error("Missing data to create activation contract.");
        }

        const contract = await contractBuilder.createActivationContract({
          delegation,
          delegator,
          delegate,
          eservice,
          messageTimestamp,
          pdfGenerator,
          fileManager,
          config,
          logger,
        });
        await sendContractMetadataToProcess(
          contract,
          refreshableToken,
          delegation,
          correlationId,
          clients,
          logger
        );

        logger.info(`Delegation event ${msg.type} handled successfully`);
      }
    )
    .with(
      {
        type: P.union("ConsumerDelegationRevoked", "ProducerDelegationRevoked"),
      },
      async (msg): Promise<void> => {
        if (!msg.data.delegation) {
          throw missingKafkaMessageDataError("delegation", msg.type);
        }

        const correlationId = msg.correlation_id
          ? unsafeBrandId<CorrelationId>(msg.correlation_id)
          : generateId<CorrelationId>();

        const delegation = fromDelegationV2(msg.data.delegation);
        const messageTimestamp = msg.log_date;

        const [delegator, delegate, eservice] = await Promise.all([
          retrieveTenantById(readModelService, delegation.delegatorId),
          retrieveTenantById(readModelService, delegation.delegateId),
          retrieveEserviceById(readModelService, delegation.eserviceId),
        ]);

        if (!delegator || !delegate || !eservice) {
          throw new Error("Missing data to create revocation contract.");
        }
        const contract = await contractBuilder.createRevocationContract({
          delegation,
          delegator,
          delegate,
          eservice,
          messageTimestamp,
          pdfGenerator,
          fileManager,
          config,
          logger,
        });

        await sendContractMetadataToProcess(
          contract,
          refreshableToken,
          delegation,
          correlationId,
          clients,
          logger
        );
        logger.info(`Delegation event ${msg.type} handled successfully`);
      }
    )
    .with(
      {
        type: P.union(
          "ConsumerDelegationRejected",
          "ConsumerDelegationSubmitted",
          "ProducerDelegationRejected",
          "ProducerDelegationSubmitted",
          "DelegationContractGenerated",
          "DelegationSignedContractGenerated"
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
