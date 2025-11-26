import {
  CorrelationId,
  eserviceMode,
  fromPurposeV1,
  generateId,
  missingKafkaMessageDataError,
  PurposeEventEnvelopeV1,
  Tenant,
  TenantKind,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import {
  FileManager,
  getInteropHeaders,
  getIpaCode,
  Logger,
  PDFGenerator,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import {
  retrieveEService,
  retrievePurposeDelegation,
  retrieveTenant,
} from "../service/purpose/purposeService.js";
import { config } from "../config/config.js";
import { PurposeDocumentEServiceInfo } from "../model/purposeModels.js";
import { riskAnalysisDocumentBuilder } from "../service/purpose/purposeContractBuilder.js";
import { eServiceNotFound, tenantKindNotFound } from "../model/errors.js";
import { ReadModelServiceSQL } from "../service/readModelSql.js";
import { getInteropBeClients } from "../clients/clientProvider.js";

const { purposeProcessClient } = getInteropBeClients();

// eslint-disable-next-line max-params
export async function handlePurposeMessageV1(
  decodedMessage: PurposeEventEnvelopeV1,
  pdfGenerator: PDFGenerator,
  fileManager: FileManager,
  readModelService: ReadModelServiceSQL,
  refreshableToken: RefreshableInteropToken,
  logger: Logger
): Promise<void> {
  await match(decodedMessage)
    .with(
      {
        type: P.union("PurposeVersionActivated"),
      },
      async (msg): Promise<void> => {
        if (!msg.data.purpose) {
          throw missingKafkaMessageDataError("purpose", msg.type);
        }

        const correlationId = msg.correlation_id
          ? unsafeBrandId<CorrelationId>(msg.correlation_id)
          : generateId<CorrelationId>();

        const purpose = fromPurposeV1(msg.data.purpose);
        const purposeVersion = purpose.versions[purpose.versions.length - 1];

        const eservice = await retrieveEService(
          purpose.eserviceId,
          readModelService
        );
        if (!eservice) {
          throw eServiceNotFound(purpose.eserviceId);
        }
        const [producer, consumer, producerDelegation, consumerDelegation] =
          await Promise.all([
            retrieveTenant(eservice?.data.producerId, readModelService),
            retrieveTenant(purpose.consumerId, readModelService),
            readModelService.getActiveProducerDelegationByEserviceId(
              purpose.eserviceId
            ),
            retrievePurposeDelegation(purpose, readModelService),
          ]);

        const [producerDelegate, consumerDelegate] = await Promise.all([
          producerDelegation &&
            retrieveTenant(producerDelegation.delegateId, readModelService),
          consumerDelegation &&
            retrieveTenant(consumerDelegation.delegateId, readModelService),
        ]);

        const eserviceInfo: PurposeDocumentEServiceInfo = {
          name: eservice.data.name,
          mode: eservice.data.mode,
          producerName: producer.name,
          producerIpaCode: getIpaCode(producer),
          consumerName: consumer.name,
          consumerIpaCode: getIpaCode(consumer),
          producerDelegationId: producerDelegation?.id,
          producerDelegateName: producerDelegate?.name,
          producerDelegateIpaCode:
            producerDelegate && getIpaCode(producerDelegate),
          consumerDelegationId: consumerDelegation?.id,
          consumerDelegateName: consumerDelegate?.name,
          consumerDelegateIpaCode:
            consumerDelegate && getIpaCode(consumerDelegate),
        };

        function getTenantKind(tenant: Tenant): TenantKind {
          if (!tenant.kind) {
            throw tenantKindNotFound(tenant.id);
          }
          return tenant.kind;
        }

        const tenantKind = match(eservice.data.mode)
          .with(eserviceMode.deliver, () => getTenantKind(consumer))
          .with(eserviceMode.receive, () => getTenantKind(producer))
          .exhaustive();

        const contract = await riskAnalysisDocumentBuilder(
          pdfGenerator,
          fileManager,
          config,
          logger
        ).createRiskAnalysisDocument(
          purpose,
          purposeVersion.dailyCalls,
          eserviceInfo,
          purposeVersion.stamps?.creation.who,
          tenantKind,
          "it"
        );
        const contractWithIsoString = {
          ...contract,
          createdAt: contract.createdAt.toISOString(),
        };

        logger.info(
          `purpose version document generated with id ${contractWithIsoString.id}`
        );

        const token = (await refreshableToken.get()).serialized;
        await purposeProcessClient.addUnsignedRiskAnalysisDocumentMetadata(
          contractWithIsoString,
          {
            params: { purposeId: purpose.id, versionId: purposeVersion.id },
            headers: getInteropHeaders({
              token,
              correlationId,
            }),
          }
        );
      }
    )
    .with(
      {
        type: P.union(
          "PurposeCreated",
          "PurposeUpdated",
          "PurposeVersionSuspended",
          "PurposeVersionArchived",
          "PurposeVersionWaitedForApproval",
          "PurposeVersionRejected",
          "PurposeVersionCreated",
          "PurposeVersionUpdated",
          "PurposeDeleted",
          "PurposeVersionDeleted"
        ),
      },
      () => Promise.resolve()
    )
    .exhaustive();
}
