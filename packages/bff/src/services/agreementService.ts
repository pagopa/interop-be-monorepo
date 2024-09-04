/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import {
  getAllFromPaginated,
  toSetToArray,
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
} from "../providers/clientProvider.js";
import { BffAppContext, Headers } from "../utilities/context.js";
import { agreementDescriptorNotFound } from "../model/domain/errors.js";
import {
  toCompactEservice,
  toCompactDescriptor,
} from "../model/api/apiConverter.js";
import { isAgreementUpgradable } from "../model/validators.js";
import { getBulkAttributes } from "./attributeService.js";
import { enhanceTenantAttributes } from "./tenantService.js";

export function agreementServiceBuilder(clients: PagoPAInteropBeClients) {
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
        enrichListAgreement(a, clients, ctx)
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

  return allAgreements
    .sort((firstAgreement, secondAgreement) => {
      if (firstAgreement.version !== secondAgreement.version) {
        const descriptorFirstAgreement = eservice.descriptors.find(
          (d) => d.id === firstAgreement.descriptorId
        );
        const descriptorSecondAgreement = eservice.descriptors.find(
          (d) => d.id === secondAgreement.descriptorId
        );

        return descriptorFirstAgreement && descriptorSecondAgreement
          ? Number(descriptorSecondAgreement.version) -
              Number(descriptorFirstAgreement.version)
          : 0;
      } else {
        return (
          new Date(secondAgreement.createdAt).getTime() -
          new Date(firstAgreement.createdAt).getTime()
        );
      }
    })
    .at(0);
};

async function enrichListAgreement(
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
  const allAttributesIds = toSetToArray([
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
      contactMail: producer.mails.find(
        (m) => m.kind === tenantApi.MailKind.Values.CONTACT_EMAIL
      ),
    },
    consumer: {
      id: agreement.consumerId,
      selfcareId: consumer.selfcareId,
      externalId: consumer.externalId,
      createdAt: consumer.createdAt,
      updatedAt: consumer.updatedAt,
      name: consumer.name,
      attributes: tenantAttributes,
      contactMail: consumer.mails.find(
        (m) => m.kind === tenantApi.MailKind.Values.CONTACT_EMAIL
      ),
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
