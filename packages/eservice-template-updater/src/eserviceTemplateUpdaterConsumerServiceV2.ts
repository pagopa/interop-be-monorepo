import {
  CorrelationId,
  EServiceTemplateEventEnvelope,
  EServiceTemplateEventV2,
  EServiceTemplateId,
  generateId,
  missingKafkaMessageDataError,
  PurposeEventEnvelopeV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  getAllFromPaginated,
  getInteropHeaders,
  InteropHeaders,
  logger,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { getInteropBeClients } from "./clients/clientsProvider.js";

const { catalogProcess, eserviceTemplateProcess } = getInteropBeClients();

export async function handleMessageV2({
  decodedKafkaMessage,
  refreshableToken,
  partition,
  offset,
}: {
  decodedKafkaMessage: EServiceTemplateEventEnvelope;
  refreshableToken: RefreshableInteropToken;
  partition: number;
  offset: string;
}): Promise<void> {
  const correlationId = decodedKafkaMessage.correlation_id
    ? unsafeBrandId<CorrelationId>(decodedKafkaMessage.correlation_id)
    : generateId<CorrelationId>();

  const loggerInstance = logger({
    serviceName: "client-purpose-updater",
    eventType: decodedKafkaMessage.type,
    eventVersion: decodedKafkaMessage.event_version,
    streamId: decodedKafkaMessage.stream_id,
    correlationId,
  });

  loggerInstance.info(
    `Processing ${decodedKafkaMessage.type} message - Partition number: ${partition} - Offset: ${offset}`
  );

  await match(decodedKafkaMessage)
    .with({ type: "EServiceTemplateNameUpdated" }, async (msg) => {
      if (!msg.data.eserviceTemplate) {
        throw missingKafkaMessageDataError("purpose", msg.type);
      }

      const token = (await refreshableToken.get()).serialized;
      const headers = getInteropHeaders({
        token,
        correlationId,
      });

      const { eserviceTemplate } = msg.data;

      const newName = eserviceTemplate.name;

      const instances =
        await eserviceTemplateProcess.eserviceTemplate.getEServiceTemplateInstances(
          {
            params: {
              eServiceTemplateId: eserviceTemplate.id,
            },
            queries: {
              limit: 0,
              offset: 0,
            },
            headers,
          }
        );

      for (const instance in instances.results) {
        await catalogProcess.client.internalUpdateNameAfterTemplateUpdate;
      }

      // TODO
    })
    .with(
      { type: "PurposeAdded" },
      { type: "DraftPurposeUpdated" },
      { type: "NewPurposeVersionActivated" },
      { type: "NewPurposeVersionWaitingForApproval" },
      { type: "PurposeActivated" },
      { type: "PurposeVersionOverQuotaUnsuspended" },
      { type: "PurposeVersionRejected" },
      { type: "PurposeVersionSuspendedByConsumer" },
      { type: "PurposeVersionSuspendedByProducer" },
      { type: "PurposeVersionUnsuspendedByConsumer" },
      { type: "PurposeVersionUnsuspendedByProducer" },
      { type: "PurposeWaitingForApproval" },
      { type: "WaitingForApprovalPurposeVersionDeleted" },
      { type: "PurposeVersionActivated" },
      { type: "PurposeCloned" },
      { type: "DraftPurposeDeleted" },
      { type: "WaitingForApprovalPurposeDeleted" },
      { type: "PurposeDeletedByRevokedDelegation" },
      () => Promise.resolve
    )
    .exhaustive();
}

async function getAllEServiceTemplateInstances(
  eserviceTemplateId: EServiceTemplateId,
  headers: InteropHeaders
) {
  return await getAllFromPaginated<eserviceTemplateApi.EServiceTemplateInstance>(
    async (offset, limit) =>
      await eserviceTemplateProcess.eserviceTemplate.getEServiceTemplateInstances(
        {
          headers,
          queries: {
            states: []
            offset,
            limit,
          },
        }
      )
  );
}
