/* eslint-disable sonarjs/cognitive-complexity */
import { randomUUID } from "crypto";
import {
  CorrelationId,
  Descriptor,
  descriptorState,
  Document,
  EService,
  EServiceTemplate,
  EServiceTemplateEventEnvelope,
  EServiceTemplateVersion,
  fromEServiceTemplateV2,
  generateId,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  FileManager,
  getInteropHeaders,
  InteropHeaders,
  Logger,
  logger,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { getInteropBeClients } from "./clients/clientsProvider.js";
import { config } from "./config/config.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

const { catalogProcess } = getInteropBeClients();

export async function handleMessageV2({
  decodedKafkaMessage,
  refreshableToken,
  partition,
  offset,
  readModelService,
  fileManager,
}: {
  decodedKafkaMessage: EServiceTemplateEventEnvelope;
  refreshableToken: RefreshableInteropToken;
  partition: number;
  offset: string;
  readModelService: ReadModelServiceSQL;
  fileManager: FileManager;
}): Promise<void> {
  const correlationId = decodedKafkaMessage.correlation_id
    ? unsafeBrandId<CorrelationId>(decodedKafkaMessage.correlation_id)
    : generateId<CorrelationId>();

  const loggerInstance = logger({
    serviceName: "eservice-template-instances-updater",
    eventType: decodedKafkaMessage.type,
    eventVersion: decodedKafkaMessage.event_version,
    streamId: decodedKafkaMessage.stream_id,
    streamVersion: decodedKafkaMessage.version,
    correlationId,
  });

  loggerInstance.info(
    `Processing ${decodedKafkaMessage.type} message - Partition number: ${partition} - Offset: ${offset}`
  );

  await match(decodedKafkaMessage)
    .with({ type: "EServiceTemplateNameUpdated" }, async (msg) => {
      const newName = getTemplateFromEvent(msg).name;

      const updateTemplateInstanceName = async (
        instance: EService,
        headers: InteropHeaders
      ): Promise<void> => {
        await catalogProcess.client.updateTemplateInstanceName(
          { name: newName },
          {
            params: {
              eServiceId: instance.id,
            },
            headers,
          }
        );
      };

      await commitUpdateToTemplateInstances(
        msg,
        refreshableToken,
        correlationId,
        readModelService,
        updateTemplateInstanceName
      );
    })
    .with({ type: "EServiceTemplateDescriptionUpdated" }, async (msg) => {
      const newDescription = getTemplateFromEvent(msg).description;

      const updateTemplateEServiceDescription = async (
        instance: EService,
        headers: InteropHeaders
      ): Promise<void> => {
        await catalogProcess.client.updateTemplateInstanceDescription(
          { description: newDescription },
          {
            params: {
              eServiceId: instance.id,
            },
            headers,
          }
        );
      };

      await commitUpdateToTemplateInstances(
        msg,
        refreshableToken,
        correlationId,
        readModelService,
        updateTemplateEServiceDescription
      );
    })
    .with({ type: "EServiceTemplateVersionAttributesUpdated" }, async (msg) => {
      const eserviceTemplateVersion = getTemplateVersionFromEvent(msg);

      const attributes = eserviceTemplateVersion.attributes;

      const updateTemplateInstanceDescriptorAttributes = async (
        instance: EService,
        headers: InteropHeaders
      ): Promise<void> => {
        const descriptors = retrieveTemplateInstanceDescriptors(
          instance,
          eserviceTemplateVersion.id
        );

        for (const descriptor of descriptors) {
          await catalogProcess.client.updateTemplateInstanceDescriptorAttributes(
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
      };

      await commitUpdateToTemplateInstances(
        msg,
        refreshableToken,
        correlationId,
        readModelService,
        updateTemplateInstanceDescriptorAttributes
      );
    })
    .with({ type: "EServiceTemplateVersionQuotasUpdated" }, async (msg) => {
      const eserviceTemplateVersion = getTemplateVersionFromEvent(msg);

      const updateTemplateInstanceDescriptorVoucherLifespan = async (
        instance: EService,
        headers: InteropHeaders
      ): Promise<void> => {
        const descriptors = retrieveTemplateInstanceDescriptors(
          instance,
          eserviceTemplateVersion.id
        );

        for (const descriptor of descriptors) {
          await catalogProcess.client.updateTemplateInstanceDescriptorVoucherLifespan(
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
      };

      await commitUpdateToTemplateInstances(
        msg,
        refreshableToken,
        correlationId,
        readModelService,
        updateTemplateInstanceDescriptorVoucherLifespan
      );
    })
    .with({ type: "EServiceTemplateVersionDocumentAdded" }, async (msg) => {
      const docToAddToInstances = getTemplateDocumentFromEvent(msg);

      const addDocumentToEServiceTemplateInstanceDescriptor = async (
        instance: EService,
        headers: InteropHeaders
      ): Promise<void> => {
        const descriptors = retrieveTemplateInstanceDescriptors(
          instance,
          msg.data.eserviceTemplateVersionId
        );

        for (const descriptor of descriptors) {
          const alreadyHasDoc = descriptor.docs.some(
            (d) => d.checksum === docToAddToInstances.checksum
          );
          if (alreadyHasDoc || descriptor.state === descriptorState.archived) {
            continue;
          }

          const clonedDoc = await cloneDocument(
            docToAddToInstances,
            fileManager,
            loggerInstance
          );

          try {
            await catalogProcess.client.createTemplateInstanceDescriptorDocument(
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
      };

      await commitUpdateToTemplateInstances(
        msg,
        refreshableToken,
        correlationId,
        readModelService,
        addDocumentToEServiceTemplateInstanceDescriptor
      );
    })
    .with({ type: "EServiceTemplateVersionDocumentUpdated" }, async (msg) => {
      const updatedEServiceTemplateDoc = getTemplateDocumentFromEvent(msg);

      const updateEServiceTemplateInstanceDescriptorDocument = async (
        instance: EService,
        headers: InteropHeaders
      ): Promise<void> => {
        const descriptors = retrieveTemplateInstanceDescriptors(
          instance,
          msg.data.eserviceTemplateVersionId
        );

        for (const descriptor of descriptors) {
          const docToUpdate = descriptor.docs.find(
            (d) => d.checksum === updatedEServiceTemplateDoc.checksum
          );

          if (!docToUpdate) {
            continue;
          }

          await catalogProcess.client.updateTemplateInstanceDescriptorDocument(
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
      };

      await commitUpdateToTemplateInstances(
        msg,
        refreshableToken,
        correlationId,
        readModelService,
        updateEServiceTemplateInstanceDescriptorDocument
      );
    })
    .with({ type: "EServiceTemplateVersionDocumentDeleted" }, async (msg) => {
      const eserviceTemplateVersion = getTemplateVersionFromEvent(msg);

      const deleteEServiceTemplateInstanceDescriptorDocument = async (
        instance: EService,
        headers: InteropHeaders
      ): Promise<void> => {
        const descriptors = retrieveTemplateInstanceDescriptors(
          instance,
          msg.data.eserviceTemplateVersionId
        );

        for (const descriptor of descriptors) {
          const docToDelete = descriptor.docs.find(
            (d) =>
              !eserviceTemplateVersion.docs.some(
                (doc) => doc.checksum === d.checksum
              )
          );
          if (!docToDelete) {
            continue;
          }
          await catalogProcess.client.deleteTemplateInstanceDescriptorDocument(
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
      };

      await commitUpdateToTemplateInstances(
        msg,
        refreshableToken,
        correlationId,
        readModelService,
        deleteEServiceTemplateInstanceDescriptorDocument
      );
    })
    .with(
      { type: "EServiceTemplateAdded" },
      { type: "EServiceTemplateIntendedTargetUpdated" },
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
      { type: "EServiceTemplatePersonalDataFlagUpdatedAfterPublication" },
      () => Promise.resolve
    )
    .exhaustive();
}

function getTemplateDocumentFromEvent(
  msg: EServiceTemplateEventEnvelope & {
    data: { documentId: string; eserviceTemplateVersionId: string };
  }
): Document {
  const eserviceTemplateVersion = getTemplateVersionFromEvent(msg);

  const doc = eserviceTemplateVersion.docs.find(
    (d) => d.id === msg.data.documentId
  );

  if (!doc) {
    throw missingKafkaMessageDataError("document", msg.type);
  }

  return doc;
}

function getTemplateFromEvent(
  msg: EServiceTemplateEventEnvelope
): EServiceTemplate {
  if (!msg.data.eserviceTemplate) {
    throw missingKafkaMessageDataError("eserviceTemplate", msg.type);
  }

  return fromEServiceTemplateV2(msg.data.eserviceTemplate);
}

function retrieveTemplateInstanceDescriptors(
  instance: EService,
  eserviceTemplateVersionId: string
): Descriptor[] {
  return instance.descriptors.filter(
    (d) => d.templateVersionRef?.id === eserviceTemplateVersionId
  );
}

function getTemplateVersionFromEvent(
  msg: EServiceTemplateEventEnvelope & {
    data: { eserviceTemplateVersionId: string };
  }
): EServiceTemplateVersion {
  const eserviceTemplate = getTemplateFromEvent(msg);

  const eserviceTemplateVersion = eserviceTemplate.versions.find(
    (v) => v.id === msg.data.eserviceTemplateVersionId
  );

  if (!eserviceTemplateVersion) {
    throw missingKafkaMessageDataError("eserviceTemplateVersion", msg.type);
  }

  return eserviceTemplateVersion;
}

async function commitUpdateToTemplateInstances(
  msg: EServiceTemplateEventEnvelope,
  refreshableToken: RefreshableInteropToken,
  correlationId: CorrelationId,
  readModelService: ReadModelServiceSQL,
  action: (eservice: EService, headers: InteropHeaders) => Promise<void>
): Promise<void> {
  const token = (await refreshableToken.get()).serialized;
  const headers = getInteropHeaders({
    token,
    correlationId,
  });

  const instances = await readModelService.getEServiceTemplateInstances(
    getTemplateFromEvent(msg).id
  );

  const chunkSize = 10;
  // Call the action on each instance in chunks
  // eslint-disable-next-line functional/no-let
  for (let i = 0; i < instances.length; i += chunkSize) {
    const chunk = instances.slice(i, i + chunkSize);
    await Promise.all(chunk.map((instance) => action(instance, headers)));
  }
}

async function cloneDocument(
  doc: Document,
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
