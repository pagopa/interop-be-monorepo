/* eslint-disable max-params */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { randomUUID } from "crypto";
import {
  FileManager,
  getAllFromPaginated,
  removeDuplicates,
  WithLogger,
} from "pagopa-interop-commons";
import {
  bffApi,
  catalogApi,
  agreementApi,
  tenantApi,
  attributeRegistryApi,
} from "pagopa-interop-api-clients";
import {
  AgreementProcessClient,
  PagoPAInteropBeClients,
} from "../clients/clientsProvider.js";
import { BffAppContext, Headers } from "../utilities/context.js";
import {
  agreementDescriptorNotFound,
  contractException,
  contractNotFound,
  invalidContentType,
} from "../model/errors.js";
import { config } from "../config/config.js";
import { contentTypes } from "../utilities/mimeTypes.js";
import { getLatestTenantContactEmail } from "../model/modelMappingUtils.js";
import {
  toCompactEservice,
  toCompactDescriptor,
} from "../api/catalogApiConverter.js";
import {
  toBffCompactOrganization,
  toCompactEserviceLight,
} from "../api/agreementApiConverter.js";
import { getBulkAttributes } from "./attributeService.js";
import { enhanceTenantAttributes } from "./tenantService.js";
import { isAgreementUpgradable } from "./validators.js";

export function agreementServiceBuilder(
  clients: PagoPAInteropBeClients,
  fileManager: FileManager
) {
  const { agreementProcessClient } = clients;
  return {
    async createAgreement(
      payload: bffApi.AgreementPayload,
      { headers, logger, authData }: WithLogger<BffAppContext>
    ) {
      logger.info(
        `Creating agreement with consumerId ${authData.organizationId} eserviceId ${payload.eserviceId} descriptorId ${payload.descriptorId}`
      );
      return await agreementProcessClient.createAgreement(payload, {
        headers,
      });
    },

    async getAgreements(
      {
        offset,
        limit,
        producersIds,
        eservicesIds,
        consumersIds,
        states,
        showOnlyUpgradeable,
      }: {
        offset: number;
        limit: number;
        producersIds: string[];
        eservicesIds: string[];
        consumersIds: string[];
        states: bffApi.AgreementState[];
        showOnlyUpgradeable?: boolean;
      },
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.Agreements> {
      ctx.logger.info("Retrieving agreements");

      const { results, totalCount } =
        await agreementProcessClient.getAgreements({
          queries: {
            offset,
            limit,
            showOnlyUpgradeable,
            eservicesIds,
            consumersIds,
            producersIds,
            states,
          },
          headers: ctx.headers,
        });

      const agreements = results.map((a) =>
        enrichAgreementListEntry(a, clients, ctx)
      );
      return {
        pagination: {
          limit,
          offset,
          totalCount,
        },
        results: await Promise.all(agreements),
      };
    },

    async getAgreementById(
      agreementId: string,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.Agreement> {
      ctx.logger.info(`Retrieving agreement with id ${agreementId}`);
      const agreement = await agreementProcessClient.getAgreementById({
        params: { agreementId },
        headers: ctx.headers,
      });

      return enrichAgreement(agreement, clients, ctx);
    },

    async addAgreementConsumerDocument(
      agreementId: string,
      doc: bffApi.addAgreementConsumerDocument_Body,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<Buffer> {
      logger.info(`Adding consumer document to agreement ${agreementId}`);

      const documentPath = `${config.consumerDocumentsPath}/${agreementId}`;
      const documentContent = Buffer.from(await doc.doc.arrayBuffer());
      const documentId = randomUUID();

      await fileManager.storeBytes(
        {
          bucket: config.consumerDocumentsContainer,
          path: documentPath,
          resourceId: documentId,
          name: doc.doc.name,
          content: documentContent,
        },
        logger
      );

      const seed: agreementApi.DocumentSeed = {
        id: documentId,
        prettyName: doc.prettyName,
        name: doc.doc.name,
        contentType: doc.doc.type,
        path: documentPath,
      };

      await agreementProcessClient.addAgreementConsumerDocument(seed, {
        params: { agreementId },
        headers,
      });

      return documentContent;
    },

    async getAgreementConsumerDocument(
      agreementId: string,
      documentId: string,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<Buffer> {
      logger.info(
        `Retrieving consumer document ${documentId} from agreement ${agreementId}`
      );

      const document =
        await agreementProcessClient.getAgreementConsumerDocument({
          params: { agreementId, documentId },
          headers,
        });

      assertContentMediaType(document.contentType, agreementId, documentId);

      const documentBytes = await fileManager.get(
        config.consumerDocumentsContainer,
        document.path,
        logger
      );

      return Buffer.from(documentBytes);
    },

    async getAgreementContract(
      agreementId: string,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<Buffer> {
      logger.info(`Retrieving contract for agreement ${agreementId}`);

      const agreement = await agreementProcessClient.getAgreementById({
        params: { agreementId },
        headers,
      });

      if (!agreement.contract) {
        if (
          agreement.state === agreementApi.AgreementState.Values.ACTIVE ||
          agreement.state === agreementApi.AgreementState.Values.SUSPENDED ||
          agreement.state === agreementApi.AgreementState.Values.ARCHIVED
        ) {
          throw contractException(agreementId);
        }
        throw contractNotFound(agreementId);
      }

      const documentBytes = await fileManager.get(
        config.consumerDocumentsContainer,
        agreement.contract.path,
        logger
      );

      return Buffer.from(documentBytes);
    },

    async removeConsumerDocument(
      agreementId: string,
      documentId: string,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(
        `Removing consumer document with id ${documentId} from agreement ${agreementId}`
      );

      await agreementProcessClient.removeAgreementConsumerDocument(undefined, {
        params: { agreementId, documentId },
        headers,
      });
    },
    async submitAgreement(
      agreementId: string,
      payload: bffApi.AgreementSubmissionPayload,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.Agreement> {
      ctx.logger.info(`Submitting agreement ${agreementId}`);
      const agreement = await agreementProcessClient.submitAgreement(payload, {
        params: { agreementId },
        headers: ctx.headers,
      });

      return enrichAgreement(agreement, clients, ctx);
    },

    async suspendAgreement(
      agreementId: string,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.Agreement> {
      ctx.logger.info(`Suspending agreement ${agreementId}`);
      const agreement = await agreementProcessClient.suspendAgreement(
        undefined,
        {
          params: { agreementId },
          headers: ctx.headers,
        }
      );

      return enrichAgreement(agreement, clients, ctx);
    },

    async rejectAgreement(
      agreementId: string,
      payload: bffApi.AgreementRejectionPayload,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.Agreement> {
      ctx.logger.info(`Rejecting agreement ${agreementId}`);
      const agreement = await agreementProcessClient.rejectAgreement(payload, {
        params: { agreementId },
        headers: ctx.headers,
      });

      return enrichAgreement(agreement, clients, ctx);
    },

    async archiveAgreement(
      agreementId: string,
      ctx: WithLogger<BffAppContext>
    ): Promise<void> {
      ctx.logger.info(`Archiving agreement ${agreementId}`);
      await agreementProcessClient.archiveAgreement(undefined, {
        params: { agreementId },
        headers: ctx.headers,
      });
    },

    async updateAgreement(
      agreementId: string,
      payload: bffApi.AgreementUpdatePayload,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.Agreement> {
      ctx.logger.info(`Updating agreement ${agreementId}`);
      const agreement = await agreementProcessClient.updateAgreementById(
        payload,
        {
          params: { agreementId },
          headers: ctx.headers,
        }
      );

      return enrichAgreement(agreement, clients, ctx);
    },

    async upgradeAgreement(
      agreementId: string,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.Agreement> {
      ctx.logger.info(`Upgrading agreement ${agreementId}`);
      const agreement = await agreementProcessClient.upgradeAgreementById(
        undefined,
        {
          params: { agreementId },
          headers: ctx.headers,
        }
      );
      return enrichAgreement(agreement, clients, ctx);
    },

    async deleteAgreement(
      agreementId: string,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      return await agreementProcessClient.deleteAgreement(undefined, {
        params: { agreementId },
        headers,
      });
    },

    async activateAgreement(
      agreementId: string,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.Agreement> {
      const agreement = await agreementProcessClient.activateAgreement(
        undefined,
        {
          params: { agreementId },
          headers: ctx.headers,
        }
      );
      return enrichAgreement(agreement, clients, ctx);
    },

    async cloneAgreement(
      agreementId: string,
      { headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> {
      const agreement = await agreementProcessClient.cloneAgreement(undefined, {
        params: { agreementId },
        headers,
      });
      return { id: agreement.id };
    },

    async getAgreementsEserviceProducers(
      {
        offset,
        limit,
        requesterId,
        states,
        eServiceName,
      }: {
        offset: number;
        limit: number;
        requesterId: string;
        states: agreementApi.AgreementState[];
        eServiceName?: string;
      },
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.CompactEServicesLight> {
      logger.info(
        `Retrieving producer eservices from agreement filtered by eservice name ${eServiceName}, offset ${offset}, limit ${limit}`
      );

      if (eServiceName && eServiceName.length < 3) {
        return emptyPagination(offset, limit);
      }

      const eservices = await agreementProcessClient.getAgreementEServices({
        queries: {
          offset,
          limit,
          eServiceName,
          producersIds: [requesterId],
          states,
        },
        headers,
      });

      return {
        pagination: {
          limit,
          offset,
          totalCount: eservices.totalCount,
        },
        results: eservices.results.map((e) => toCompactEserviceLight(e)),
      };
    },

    async getAgreementsEserviceConsumers(
      offset: number,
      limit: number,
      requesterId: string,
      eServiceName: string | undefined,
      { headers, logger }: WithLogger<BffAppContext>
    ) {
      logger.info(
        `Retrieving consumer eservices from agreement filtered by eservice name ${eServiceName}, offset ${offset}, limit ${limit}`
      );

      if (eServiceName && eServiceName.length < 3) {
        return emptyPagination(offset, limit);
      }

      const eservices = await agreementProcessClient.getAgreementEServices({
        queries: {
          offset,
          limit,
          eServiceName,
          consumersIds: [requesterId],
        },
        headers,
      });

      return {
        pagination: {
          limit,
          offset,
          totalCount: eservices.totalCount,
        },
        results: eservices.results.map((e) => toCompactEserviceLight(e)),
      };
    },

    async getAgreementProducers(
      offset: number,
      limit: number,
      producerName: string | undefined,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CompactOrganizations> {
      logger.info(`Retrieving agreement producers`);

      if (producerName && producerName.length < 3) {
        return emptyPagination(offset, limit);
      }

      const producers = await agreementProcessClient.getAgreementProducers({
        queries: {
          offset,
          limit,
          producerName,
        },
        headers,
      });

      return {
        pagination: {
          limit,
          offset,
          totalCount: producers.totalCount,
        },
        results: producers.results.map((p) => toBffCompactOrganization(p)),
      };
    },

    async getAgreementConsumers(
      offset: number,
      limit: number,
      consumerName: string | undefined,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CompactOrganizations> {
      logger.info(`Retrieving agreement consumers`);

      if (consumerName && consumerName.length < 3) {
        return emptyPagination(offset, limit);
      }

      const consumers = await agreementProcessClient.getAgreementConsumers({
        queries: {
          offset,
          limit,
          consumerName,
        },
        headers,
      });

      return {
        pagination: {
          limit,
          offset,
          totalCount: consumers.totalCount,
        },
        results: consumers.results.map((c) => toBffCompactOrganization(c)),
      };
    },
  };
}

export const getLatestAgreement = async (
  agreementProcessClient: AgreementProcessClient,
  consumerId: string,
  eservice: catalogApi.EService,
  headers: Headers
): Promise<agreementApi.Agreement | undefined> => {
  const allAgreements = await getAllFromPaginated(
    async (offset: number, limit: number) =>
      agreementProcessClient.getAgreements({
        headers,
        queries: {
          consumersIds: [consumerId],
          eservicesIds: [eservice.id],
          limit,
          offset,
        },
      })
  );

  type AgreementAndDescriptor = {
    agreement: agreementApi.Agreement;
    descriptor: catalogApi.EServiceDescriptor;
  };

  const agreementAndDescriptor = allAgreements.reduce<AgreementAndDescriptor[]>(
    (acc, agreement) => {
      const descriptor = eservice.descriptors.find(
        (d) => d.id === agreement.descriptorId
      );
      if (descriptor) {
        acc.push({ agreement, descriptor });
      }
      return acc;
    },
    []
  );

  return agreementAndDescriptor
    .sort((first, second) => {
      const descriptorFirstAgreement = first.descriptor;
      const descriptorSecondAgreement = second.descriptor;
      if (
        descriptorFirstAgreement.version !== descriptorSecondAgreement.version
      ) {
        return (
          Number(descriptorSecondAgreement.version) -
          Number(descriptorFirstAgreement.version)
        );
      } else {
        return (
          new Date(second.agreement.createdAt).getTime() -
          new Date(first.agreement.createdAt).getTime()
        );
      }
    })
    .at(0)?.agreement;
};

async function enrichAgreementListEntry(
  agreement: agreementApi.Agreement,
  clients: PagoPAInteropBeClients,
  ctx: WithLogger<BffAppContext>
): Promise<bffApi.AgreementListEntry> {
  const { consumer, producer, eservice } = await getConsumerProducerEservice(
    agreement,
    clients,
    ctx
  );

  const currentDescriptor = getCurrentDescriptor(eservice, agreement);

  return {
    id: agreement.id,
    state: agreement.state,
    consumer: {
      id: consumer.id,
      name: consumer.name,
      kind: consumer.kind,
    },
    eservice: toCompactEservice(eservice, producer),
    descriptor: toCompactDescriptor(currentDescriptor),
    canBeUpgraded: isAgreementUpgradable(eservice, agreement),
    suspendedByConsumer: agreement.suspendedByConsumer,
    suspendedByProducer: agreement.suspendedByProducer,
    suspendedByPlatform: agreement.suspendedByPlatform,
  };
}

export async function enrichAgreement(
  agreement: agreementApi.Agreement,
  clients: PagoPAInteropBeClients,
  ctx: WithLogger<BffAppContext>
): Promise<bffApi.Agreement> {
  const { consumer, producer, eservice } = await getConsumerProducerEservice(
    agreement,
    clients,
    ctx
  );

  const currentDescriptior = getCurrentDescriptor(eservice, agreement);

  const activeDescriptor = eservice.descriptors
    .toSorted((a, b) => Number(a.version) - Number(b.version))
    .at(-1);
  const activeDescriptorAttributes = activeDescriptor
    ? descriptorAttributesIds(activeDescriptor)
    : [];
  const allAttributesIds = removeDuplicates([
    ...activeDescriptorAttributes,
    ...tenantAttributesIds(consumer),
  ]);

  const attributes = await getBulkAttributes(
    allAttributesIds,
    clients.attributeProcessClient,
    ctx
  );

  const agreementVerifiedAttrs = filterAttributes(
    attributes,
    agreement.verifiedAttributes.map((attr) => attr.id)
  );
  const agreementCertifiedAttrs = filterAttributes(
    attributes,
    agreement.certifiedAttributes.map((attr) => attr.id)
  );
  const agreementDeclaredAttrs = filterAttributes(
    attributes,
    agreement.declaredAttributes.map((attr) => attr.id)
  );
  const tenantAttributes = enhanceTenantAttributes(
    consumer.attributes,
    attributes
  );
  return {
    id: agreement.id,
    descriptorId: agreement.descriptorId,
    producer: {
      id: agreement.producerId,
      name: producer.name,
      kind: producer.kind,
      contactMail: getLatestTenantContactEmail(producer),
    },
    consumer: {
      id: agreement.consumerId,
      selfcareId: consumer.selfcareId,
      externalId: consumer.externalId,
      createdAt: consumer.createdAt,
      updatedAt: consumer.updatedAt,
      name: consumer.name,
      attributes: tenantAttributes,
      contactMail: getLatestTenantContactEmail(consumer),
      features: consumer.features,
    },
    eservice: {
      id: agreement.eserviceId,
      name: eservice.name,
      version: currentDescriptior.version,
      activeDescriptor,
    },
    state: agreement.state,
    verifiedAttributes: agreementVerifiedAttrs,
    certifiedAttributes: agreementCertifiedAttrs,
    declaredAttributes: agreementDeclaredAttrs,
    suspendedByConsumer: agreement.suspendedByConsumer,
    suspendedByProducer: agreement.suspendedByProducer,
    suspendedByPlatform: agreement.suspendedByPlatform,
    isContractPresent: agreement.contract !== undefined,
    consumerDocuments: agreement.consumerDocuments,
    createdAt: agreement.createdAt,
    updatedAt: agreement.updatedAt,
    suspendedAt: agreement.suspendedAt,
    consumerNotes: agreement.consumerNotes,
    rejectionReason: agreement.rejectionReason,
  };
}

function descriptorAttributesIds(
  descriptor: catalogApi.EServiceDescriptor
): string[] {
  const { verified, declared, certified } = descriptor.attributes;
  const allAttributes = [
    ...verified.flat(),
    ...declared.flat(),
    ...certified.flat(),
  ];
  return allAttributes.map((attr) => attr.id);
}

function tenantAttributesIds(tenant: tenantApi.Tenant): string[] {
  const verifiedIds = tenant.attributes.map((attr) => attr.verified?.id);
  const certifiedIds = tenant.attributes.map((attr) => attr.certified?.id);
  const declaredIds = tenant.attributes.map((attr) => attr.declared?.id);

  return [...verifiedIds, ...certifiedIds, ...declaredIds].filter(
    (x): x is string => x !== undefined
  );
}

async function getConsumerProducerEservice(
  agreement: agreementApi.Agreement,
  { tenantProcessClient, catalogProcessClient }: PagoPAInteropBeClients,
  { headers }: WithLogger<BffAppContext>
): Promise<{
  consumer: tenantApi.Tenant;
  producer: tenantApi.Tenant;
  eservice: catalogApi.EService;
}> {
  const consumerTask = tenantProcessClient.tenant.getTenant({
    params: { id: agreement.consumerId },
    headers,
  });

  const producerTask = tenantProcessClient.tenant.getTenant({
    params: { id: agreement.producerId },
    headers,
  });
  const eserviceTask = catalogProcessClient.getEServiceById({
    params: { eServiceId: agreement.eserviceId },
    headers,
  });
  const [consumer, producer, eservice] = await Promise.all([
    consumerTask,
    producerTask,
    eserviceTask,
  ]);

  return {
    consumer,
    producer,
    eservice,
  };
}

function filterAttributes(
  attributes: attributeRegistryApi.Attribute[],
  filterIds: string[]
): attributeRegistryApi.Attribute[] {
  return attributes.filter((attr) => filterIds.includes(attr.id));
}

export function getCurrentDescriptor(
  eservice: catalogApi.EService,
  agreement: agreementApi.Agreement
): catalogApi.EServiceDescriptor {
  const descriptor = eservice.descriptors.find(
    (descriptor) => descriptor.id === agreement.descriptorId
  );

  if (!descriptor) {
    throw agreementDescriptorNotFound(agreement.id);
  }
  return descriptor;
}

function assertContentMediaType(
  contentType: string,
  agreementId: string,
  documentId: string
): void {
  if (!contentTypes.includes(contentType)) {
    throw invalidContentType(contentType, agreementId, documentId);
  }
}
const emptyPagination = (offset: number, limit: number) => ({
  pagination: {
    limit,
    offset,
    totalCount: 0,
  },
  results: [],
});
