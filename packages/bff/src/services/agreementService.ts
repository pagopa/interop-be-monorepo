/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { WithLogger } from "pagopa-interop-commons";
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
import {
  toApiDeclaredTenantAttribute,
  toApiCertifiedTenantAttribute,
  toApiVerifiedTenantAttribute,
} from "../model/api/apiConverter.js";
import { agreementDescriptorNotFound } from "../model/domain/errors.js";

export function agreementServiceBuilder(clients: PagoPAInteropBeClients) {
  const { agreementProcessClient } = clients;
  return {
    async createAgreement(
      payload: bffApi.AgreementPayload,
      { headers, logger }: WithLogger<BffAppContext>
    ) {
      logger.info(`Creating agreement with seed ${JSON.stringify(payload)}`);
      return await agreementProcessClient.createAgreement(payload, {
        headers,
      });
    },

    async getAgreements({
      offset,
      limit,
      producersIds,
      eservicesIds,
      consumersIds,
      states,
      ctx,
      showOnlyUpgradeable,
    }: {
      offset: number;
      limit: number;
      producersIds: string[];
      eservicesIds: string[];
      consumersIds: string[];
      states: bffApi.AgreementState[];
      ctx: WithLogger<BffAppContext>;
      showOnlyUpgradeable?: boolean;
    }): Promise<bffApi.Agreements> {
      ctx.logger.info("Retrieving agreements");

      const { results, totalCount } =
        await agreementProcessClient.getAgreements({
          queries: {
            offset,
            limit,
            showOnlyUpgradeable,
            eservicesIds: eservicesIds.join(","),
            consumersIds: consumersIds.join(","),
            producersIds: producersIds.join(","),
            states: states.join(","),
          },
          headers: ctx.headers,
        });

      const agreements = results.map((a) => enrichAgreement(a, clients, ctx));
      return {
        pagination: {
          limit,
          offset,
          totalCount,
        },
        results: await Promise.all(agreements),
      };
    },
  };
}

export const getLatestAgreement = async (
  agreementProcessClient: AgreementProcessClient,
  consumerId: string,
  eservice: catalogApi.EService,
  headers: Headers
): Promise<agreementApi.Agreement> => {
  const getAgreementsFrom = async (
    start: number
  ): Promise<agreementApi.Agreements> =>
    await agreementProcessClient.getAgreements({
      headers: { ...headers },
      queries: {
        consumersIds: consumerId,
        eservicesIds: eservice.id,
        offset: start,
        limit: 50,
      },
    });

  // Fetched all agreements in a recursive way
  const getAgreements = async (
    start: number
  ): Promise<agreementApi.Agreement[]> => {
    const agreements = (await getAgreementsFrom(start)).results;

    if (agreements.length >= 50) {
      return agreements.concat(await getAgreements(start + 50));
    }
    return agreements;
  };

  const allAgreements = await getAgreements(0);

  return allAgreements.sort((firstAgreement, secondAgreement) => {
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
  })[0];
};

function isUpgradable(
  descriptor: catalogApi.EServiceDescriptor,
  agreement: agreementApi.Agreement,
  descriptors: catalogApi.EServiceDescriptor[]
): boolean {
  return descriptors
    .filter((d) => parseInt(d.version, 10) > parseInt(descriptor.version, 10))
    .some(
      (d) =>
        (d.state === "PUBLISHED" || d.state === "SUSPENDED") &&
        (agreement.state === "ACTIVE" || agreement.state === "SUSPENDED")
    );
}

async function enrichAgreement(
  agreement: agreementApi.Agreement,
  clients: PagoPAInteropBeClients,
  ctx: WithLogger<BffAppContext>
): Promise<bffApi.AgreementListEntry> {
  const { consumer, producer, eservice } = await parallelGet(
    agreement,
    clients,
    ctx
  );

  const currentDescriptior = eservice.descriptors.find(
    (d) => d.id === agreement.descriptorId
  );
  if (!currentDescriptior) {
    throw agreementDescriptorNotFound(agreement.id);
  }

  return {
    id: agreement.id,
    state: agreement.state,
    consumer: {
      id: consumer.id,
      name: consumer.name,
      kind: consumer.kind,
    },
    eservice: {
      id: eservice.id,
      name: eservice.name,
      producer: {
        id: producer.id,
        name: producer.name,
      },
    },
    descriptor: {
      id: currentDescriptior.id,
      audience: currentDescriptior.audience,
      state: currentDescriptior.state,
      version: currentDescriptior.version,
    },
    canBeUpgraded: isUpgradable(
      currentDescriptior,
      agreement,
      eservice.descriptors
    ),
    suspendedByConsumer: agreement.suspendedByConsumer,
    suspendedByProducer: agreement.suspendedByProducer,
    suspendedByPlatform: agreement.suspendedByPlatform,
  };
}

export async function enhanceAgreement(
  agreement: agreementApi.Agreement,
  clients: PagoPAInteropBeClients,
  ctx: WithLogger<BffAppContext>
): Promise<bffApi.Agreement> {
  const { consumer, producer, eservice } = await parallelGet(
    agreement,
    clients,
    ctx
  );

  const currentDescriptior = eservice.descriptors.find(
    (d) => d.id === agreement.descriptorId
  );
  if (!currentDescriptior) {
    throw agreementDescriptorNotFound(agreement.id);
  }

  const activeDescriptor = eservice.descriptors
    .toSorted((a, b) => parseInt(a.version, 10) - parseInt(b.version, 10))
    .at(-1);
  const activeDescriptorAttributes = activeDescriptor
    ? descriptorAttributesIds(activeDescriptor)
    : [];
  const allAttributesIds = Array.from(
    new Set([...activeDescriptorAttributes, ...tenantAttributesIds(consumer)])
  );

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
      contactMail: producer.mails.find((m) => m.kind === "CONTACT_EMAIL"),
    },
    consumer: {
      id: agreement.consumerId,
      selfcareId: consumer.selfcareId,
      externalId: consumer.externalId,
      createdAt: consumer.createdAt,
      updatedAt: consumer.updatedAt,
      name: consumer.name,
      attributes: tenantAttributes,
      contactMail: consumer.mails.find((m) => m.kind === "CONTACT_EMAIL"),
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
    isContractPresent: agreement.contract !== undefined,
    consumerDocuments: agreement.consumerDocuments,
    createdAt: agreement.createdAt,
    updatedAt: agreement.updatedAt,
    suspendedAt: agreement.suspendedAt,
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

async function parallelGet(
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

async function getBulkAttributes(
  ids: string[],
  attributeProcess: PagoPAInteropBeClients["attributeProcessClient"],
  { headers }: WithLogger<BffAppContext>
): Promise<attributeRegistryApi.Attribute[]> {
  async function getAttributesFrom(
    offset: number
  ): Promise<attributeRegistryApi.Attribute[]> {
    const response = await attributeProcess.getBulkedAttributes(ids, {
      queries: { offset, limit: 50 },
      headers,
    });
    return response.results;
  }

  async function aggregate(
    start: number,
    attributes: attributeRegistryApi.Attribute[]
  ): Promise<attributeRegistryApi.Attribute[]> {
    const attrs = await getAttributesFrom(start);
    if (attrs.length < 50) {
      return attributes.concat(attrs);
    } else {
      return aggregate(start + 50, attributes.concat(attrs));
    }
  }

  return aggregate(0, []);
}

function filterAttributes(
  attributes: attributeRegistryApi.Attribute[],
  filterIds: string[]
): attributeRegistryApi.Attribute[] {
  return attributes.filter((attr) => filterIds.includes(attr.id));
}

function enhanceTenantAttributes(
  tenantAttributes: tenantApi.TenantAttribute[],
  registryAttributes: attributeRegistryApi.Attribute[]
): bffApi.TenantAttributes {
  const registryAttributesMap: Map<string, bffApi.Attribute> = new Map(
    registryAttributes.map((attribute) => [attribute.id, attribute])
  );

  const declared = tenantAttributes
    .map((attr) => toApiDeclaredTenantAttribute(attr, registryAttributesMap))
    .filter((x): x is bffApi.DeclaredTenantAttribute => x !== null);

  const certified = tenantAttributes
    .map((attr) => toApiCertifiedTenantAttribute(attr, registryAttributesMap))
    .filter((x): x is bffApi.CertifiedTenantAttribute => x !== null);

  const verified = tenantAttributes
    .map((attr) => toApiVerifiedTenantAttribute(attr, registryAttributesMap))
    .filter((x): x is bffApi.VerifiedTenantAttribute => x !== null);

  return {
    certified,
    declared,
    verified,
  };
}
