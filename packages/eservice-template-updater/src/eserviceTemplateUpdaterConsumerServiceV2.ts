/* eslint-disable sonarjs/cognitive-complexity */
import { randomUUID } from "crypto";
import {
  CorrelationId,
  EServiceTemplateEventEnvelope,
  EServiceTemplateV2,
  EServiceTemplateVersionV2,
  fromEServiceTemplateVersionV2,
  generateId,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  FileManager,
  getAllFromPaginated,
  getInteropHeaders,
  InteropHeaders,
  Logger,
  logger,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { getInteropBeClients } from "./clients/clientsProvider.js";
import { config } from "./config/config.js";

const { catalogProcess } = getInteropBeClients();

export async function handleMessageV2({
  decodedKafkaMessage,
  refreshableToken,
  partition,
  offset,
  fileManager,
}: {
  decodedKafkaMessage: EServiceTemplateEventEnvelope;
  refreshableToken: RefreshableInteropToken;
  partition: number;
  offset: string;
  fileManager: FileManager;
}): Promise<void> {
  const correlationId = decodedKafkaMessage.correlation_id
    ? unsafeBrandId<CorrelationId>(decodedKafkaMessage.correlation_id)
    : generateId<CorrelationId>();

  const loggerInstance = logger({
    serviceName: "eservice-template-updater",
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
      const newName = getTemplateFromEvent(msg).name;

      await commitUpdateToInstances(
        msg,
        refreshableToken,
        correlationId,
        async (instance, headers) => {
          await catalogProcess.client.internalUpdateEServiceName(
            { name: newName },
            {
              params: {
                eServiceId: instance.id,
              },
              headers,
            }
          );
        }
      );
    })
    .with(
      { type: "EServiceTemplateEServiceDescriptionUpdated" },
      async (msg) => {
        const newDescription = getTemplateFromEvent(msg).eserviceDescription;

        await commitUpdateToInstances(
          msg,
          refreshableToken,
          correlationId,
          async (instance, headers) => {
            await catalogProcess.client.internalUpdateEServiceDescription(
              { description: newDescription },
              {
                params: {
                  eServiceId: instance.id,
                },
                headers,
              }
            );
          }
        );
      }
    )
    .with({ type: "EServiceTemplateVersionAttributesUpdated" }, async (msg) => {
      const eserviceTemplateVersion = getTemplateVersionFromEvent(msg);

      const attributes = fromEServiceTemplateVersionV2(
        eserviceTemplateVersion
      ).attributes;

      await commitUpdateToInstanceDescriptors(
        msg,
        refreshableToken,
        correlationId,
        async (instance, descriptor, headers) => {
          await catalogProcess.client.internalUpdateDescriptorAttributes(
            attributes,
            {
              params: {
                eServiceId: instance.id,
                descriptorId: descriptor.id,
              },
              headers,
            }
          );
        }
      );
    })
    .with({ type: "EServiceTemplateVersionQuotasUpdated" }, async (msg) => {
      const eserviceTemplateVersion = getTemplateVersionFromEvent(msg);

      await commitUpdateToInstanceDescriptors(
        msg,
        refreshableToken,
        correlationId,
        async (instance, descriptor, headers) => {
          await catalogProcess.client.internalUpdateDescriptorVoucherLifespan(
            { voucherLifespan: eserviceTemplateVersion.voucherLifespan },
            {
              params: {
                eServiceId: instance.id,
                descriptorId: descriptor.id,
              },
              headers,
            }
          );
        }
      );
    })
    .with({ type: "EServiceTemplateVersionDocumentAdded" }, async (msg) => {
      const eserviceTemplateVersion = getTemplateVersionFromEvent(msg);

      const docToAddToInstances = eserviceTemplateVersion.docs.find(
        (d) => d.id === msg.data.documentId
      );

      if (!docToAddToInstances) {
        return;
      }

      await commitUpdateToInstanceDescriptors(
        msg,
        refreshableToken,
        correlationId,
        async (instance, descriptor, headers) => {
          const alreadyHasDoc = descriptor?.docs.find(
            (d) => d.checksum === docToAddToInstances.checksum
          );

          if (alreadyHasDoc) {
            return;
          }

          if (
            descriptor.state ===
            catalogApi.EServiceDescriptorState.Values.ARCHIVED
          ) {
            return;
          }

          const clonedDoc = await cloneDocument(
            docToAddToInstances,
            fileManager,
            loggerInstance
          );

          try {
            await catalogProcess.client.internalCreateDescriptorDocument(
              clonedDoc,
              {
                params: {
                  eServiceId: instance.id,
                  descriptorId: descriptor.id,
                },
                headers,
              }
            );
          } catch (err) {
            await fileManager.delete(
              config.eserviceDocumentsContainer,
              clonedDoc.filePath,
              loggerInstance
            );
            throw err;
          }
        }
      );
    })
    .with({ type: "EServiceTemplateVersionDocumentUpdated" }, async (msg) => {
      const eserviceTemplateVersion = getTemplateVersionFromEvent(msg);

      const updatedEServiceTemplateDoc = eserviceTemplateVersion.docs.find(
        (d) => d.id === msg.data.documentId
      );

      if (!updatedEServiceTemplateDoc) {
        return;
      }

      await commitUpdateToInstanceDescriptors(
        msg,
        refreshableToken,
        correlationId,
        async (instance, descriptor, headers) => {
          const docToUpdate = descriptor?.docs.find(
            (d) => d.checksum === updatedEServiceTemplateDoc.checksum
          );

          if (!docToUpdate) {
            return;
          }

          await catalogProcess.client.internalUpdateDescriptorDocument(
            { prettyName: updatedEServiceTemplateDoc.prettyName },
            {
              params: {
                eServiceId: instance.id,
                descriptorId: descriptor.id,
                documentId: docToUpdate.id,
              },
              headers,
            }
          );
        }
      );
    })
    .with({ type: "EServiceTemplateVersionDocumentDeleted" }, async (msg) => {
      const eserviceTemplateVersion = getTemplateVersionFromEvent(msg);

      await commitUpdateToInstanceDescriptors(
        msg,
        refreshableToken,
        correlationId,
        async (instance, descriptor, headers) => {
          const docToDelete = descriptor?.docs.find(
            (d) =>
              !eserviceTemplateVersion.docs.some(
                (doc) => doc.checksum === d.checksum
              )
          );

          if (!docToDelete) {
            return;
          }

          await catalogProcess.client.internalDeleteDescriptorDocument(
            undefined,
            {
              params: {
                eServiceId: instance.id,
                descriptorId: descriptor.id,
                documentId: docToDelete.id,
              },
              headers,
            }
          );
        }
      );
    })
    .with(
      { type: "EServiceTemplateAdded" },
      { type: "EServiceTemplateAudienceDescriptionUpdated" },
      { type: "EServiceTemplateDeleted" },
      { type: "EServiceTemplateDraftUpdated" },
      { type: "EServiceTemplateDraftVersionDeleted" },
      { type: "EServiceTemplateDraftVersionUpdated" },
      { type: "EServiceTemplateRiskAnalysisAdded" },
      { type: "EServiceTemplateRiskAnalysisDeleted" },
      { type: "EServiceTemplateRiskAnalysisUpdated" },
      { type: "EServiceTemplateVersionActivated" },
      { type: "EServiceTemplateVersionAdded" },
      { type: "EServiceTemplateVersionInterfaceAdded" },
      { type: "EServiceTemplateVersionInterfaceDeleted" },
      { type: "EServiceTemplateVersionInterfaceUpdated" },
      { type: "EServiceTemplateVersionPublished" },
      { type: "EServiceTemplateVersionSuspended" },
      () => Promise.resolve
    )
    .exhaustive();
}

function getTemplateFromEvent(
  msg: EServiceTemplateEventEnvelope
): EServiceTemplateV2 {
  if (!msg.data.eserviceTemplate) {
    throw missingKafkaMessageDataError("eserviceTemplate", msg.type);
  }

  return msg.data.eserviceTemplate;
}

function getTemplateVersionFromEvent(
  msg: EServiceTemplateEventEnvelope & {
    data: { eserviceTemplateVersionId: string };
  }
): EServiceTemplateVersionV2 {
  const eserviceTemplate = getTemplateFromEvent(msg);

  const eserviceTemplateVersion = eserviceTemplate.versions.find(
    (v) => v.id === msg.data.eserviceTemplateVersionId
  );

  if (!eserviceTemplateVersion) {
    throw missingKafkaMessageDataError("eserviceTemplateVersion", msg.type);
  }

  return eserviceTemplateVersion;
}

async function commitUpdateToInstanceDescriptors(
  msg: EServiceTemplateEventEnvelope & {
    data: { eserviceTemplateVersionId: string };
  },
  refreshableToken: RefreshableInteropToken,
  correlationId: CorrelationId,
  action: (
    eservice: catalogApi.EService,
    descriptor: catalogApi.EServiceDescriptor,
    headers: InteropHeaders
  ) => Promise<void>
): Promise<void> {
  await commitUpdateToInstances(
    msg,
    refreshableToken,
    correlationId,
    async (instance, headers) => {
      const instanceDescriptor = instance.descriptors.find(
        (d) => d.templateVersionId === msg.data.eserviceTemplateVersionId
      );

      if (instanceDescriptor) {
        await action(instance, instanceDescriptor, headers);
      }
    }
  );
}

async function commitUpdateToInstances(
  msg: EServiceTemplateEventEnvelope,
  refreshableToken: RefreshableInteropToken,
  correlationId: CorrelationId,
  action: (
    eservice: catalogApi.EService,
    headers: InteropHeaders
  ) => Promise<void>
): Promise<void> {
  const token = (await refreshableToken.get()).serialized;
  const headers = getInteropHeaders({
    token,
    correlationId,
  });

  const instances = await getAllEServiceTemplateInstances(
    getTemplateFromEvent(msg).id,
    headers
  );

  await Promise.all(instances.map((instance) => action(instance, headers)));
}

async function cloneDocument(
  doc: catalogApi.EServiceDoc,
  fileManager: FileManager,
  logger: Logger
): Promise<catalogApi.CreateEServiceDescriptorDocumentSeed> {
  const clonedDocumentId = randomUUID();

  const clonedPath = await fileManager.copy(
    config.eserviceDocumentsContainer,
    doc.path,
    config.eserviceDocumentsPath,
    clonedDocumentId,
    doc.name,
    logger
  );

  return {
    documentId: clonedDocumentId,
    kind: "DOCUMENT",
    contentType: doc.contentType,
    prettyName: doc.prettyName,
    fileName: doc.name,
    filePath: clonedPath,
    checksum: doc.checksum,
    serverUrls: [],
  };
}

async function getAllEServiceTemplateInstances(
  eserviceTemplateId: string,
  headers: InteropHeaders
): Promise<catalogApi.EService[]> {
  return await getAllFromPaginated<catalogApi.EService>(
    async (offset, limit) =>
      await catalogProcess.client.getEServices({
        headers,
        queries: {
          templateIds: [eserviceTemplateId],
          offset,
          limit,
        },
      })
  );
}
