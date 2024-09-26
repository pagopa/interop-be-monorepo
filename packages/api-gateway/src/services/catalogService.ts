import { apiGatewayApi, catalogApi } from "pagopa-interop-api-clients";
import {
  getAllFromPaginated,
  removeDuplicates,
  WithLogger,
} from "pagopa-interop-commons";
import {
  AttributeProcessClient,
  CatalogProcessClient,
  TenantProcessClient,
} from "../clients/clientsProvider.js";
import { ApiGatewayAppContext } from "../utilities/context.js";
import {
  NonDraftCatalogApiDescriptor,
  toApiGatewayCatalogEservice,
  toApiGatewayDescriptorIfNotDraft,
  toApiGatewayEserviceAttributes,
} from "../api/catalogApiConverter.js";
import { eserviceDescriptorNotFound } from "../models/errors.js";
import {
  assertAvailableDescriptorExists,
  assertNonDraftDescriptor,
} from "./validators.js";
import { getAllBulkAttributes } from "./attributeService.js";
import { getOrganization } from "./tenantService.js";

export function getAllEservices(
  catalogProcessClient: CatalogProcessClient,
  headers: ApiGatewayAppContext["headers"],
  producerId: catalogApi.EService["producerId"],
  attributeId: catalogApi.Attribute["id"]
): Promise<catalogApi.EService[]> {
  return getAllFromPaginated<catalogApi.EService>(
    async (offset, limit) =>
      await catalogProcessClient.getEServices({
        headers,
        queries: {
          producersIds: [producerId],
          attributesIds: [attributeId],
          offset,
          limit,
        },
      })
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function catalogServiceBuilder(
  catalogProcessClient: CatalogProcessClient,
  tenantProcessClient: TenantProcessClient,
  attributeProcessClient: AttributeProcessClient
) {
  return {
    getEservices: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      { offset, limit }: apiGatewayApi.GetEServicesQueryParams
    ): Promise<apiGatewayApi.CatalogEServices> => {
      logger.info("Retrieving EServices");
      const paginatedEservices = await catalogProcessClient.getEServices({
        headers,
        queries: {
          offset,
          limit,
        },
      });

      return {
        results: paginatedEservices.results.map(toApiGatewayCatalogEservice),
        pagination: {
          offset,
          limit,
          totalCount: paginatedEservices.totalCount,
        },
      };
    },
    getEservice: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      eserviceId: catalogApi.EService["id"]
    ): Promise<apiGatewayApi.EService> => {
      logger.info(`Retrieving EService ${eserviceId}`);
      const eservice = await catalogProcessClient.getEServiceById({
        headers,
        params: {
          eServiceId: eserviceId,
        },
      });

      return enhanceEservice(
        tenantProcessClient,
        attributeProcessClient,
        headers,
        eservice
      );
    },
    getEserviceDescriptor: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      eserviceId: catalogApi.EService["id"],
      descriptorId: catalogApi.EServiceDescriptor["id"]
    ): Promise<apiGatewayApi.EServiceDescriptor> => {
      logger.info(
        `Retrieving Descriptor ${descriptorId} of EService ${eserviceId}`
      );

      const eservice = await catalogProcessClient.getEServiceById({
        headers,
        params: {
          eServiceId: eserviceId,
        },
      });
      const descriptor = retrieveEserviceDescriptor(eservice, descriptorId);

      return toApiGatewayDescriptorIfNotDraft(descriptor);
    },
    getEserviceDescriptors: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      eserviceId: catalogApi.EService["id"]
    ): Promise<apiGatewayApi.EServiceDescriptors> => {
      logger.info(`Retrieving Descriptors of EService ${eserviceId}`);

      const eservice = await catalogProcessClient.getEServiceById({
        headers,
        params: {
          eServiceId: eserviceId,
        },
      });

      const descriptors = eservice.descriptors
        .filter(isNonDraft)
        .map((d) => toApiGatewayDescriptorIfNotDraft(d));

      return { descriptors };
    },
  };
}

const isNonDraft = (d: catalogApi.EServiceDescriptor): boolean =>
  d.state !== catalogApi.EServiceDescriptorState.Values.DRAFT;

function retrieveEserviceDescriptor(
  eservice: catalogApi.EService,
  descriptorId: catalogApi.EServiceDescriptor["id"]
): catalogApi.EServiceDescriptor {
  const descriptor = eservice.descriptors.find((e) => e.id === descriptorId);

  if (!descriptor) {
    throw eserviceDescriptorNotFound(eservice.id, descriptorId);
  }

  return descriptor;
}

function getLatestNonDraftDescriptor(
  eservice: catalogApi.EService
): NonDraftCatalogApiDescriptor {
  const latestNonDraftDescriptor = eservice.descriptors
    .filter(isNonDraft)
    .sort((a, b) => Number(a.version) - Number(b.version))
    .at(-1);

  assertAvailableDescriptorExists(latestNonDraftDescriptor, eservice.id);
  assertNonDraftDescriptor(
    latestNonDraftDescriptor,
    latestNonDraftDescriptor.id
  );

  return latestNonDraftDescriptor;
}

async function getDescriptorAttributes(
  attributeProcessClient: AttributeProcessClient,
  headers: ApiGatewayAppContext["headers"],
  descriptor: NonDraftCatalogApiDescriptor
): Promise<apiGatewayApi.EServiceAttributes> {
  const allDescriptorAttributesIds = removeDuplicates(
    [
      ...descriptor.attributes.certified.flat(),
      ...descriptor.attributes.verified.flat(),
      ...descriptor.attributes.declared.flat(),
    ].map((a) => a.id)
  );

  const allRegistryAttributes = await getAllBulkAttributes(
    attributeProcessClient,
    headers,
    allDescriptorAttributesIds
  );

  return toApiGatewayEserviceAttributes(
    descriptor.attributes,
    allRegistryAttributes
  );
}

export async function enhanceEservice(
  tenantProcessClient: TenantProcessClient,
  attributeProcessClient: AttributeProcessClient,
  headers: ApiGatewayAppContext["headers"],
  eservice: catalogApi.EService
): Promise<apiGatewayApi.EService> {
  const latestNonDraftDescriptor = getLatestNonDraftDescriptor(eservice);
  const descriptorAttributes = await getDescriptorAttributes(
    attributeProcessClient,
    headers,
    latestNonDraftDescriptor
  );

  const producerOrganization = await getOrganization(
    tenantProcessClient,
    attributeProcessClient,
    headers,
    eservice.producerId
  );

  return {
    id: eservice.id,
    name: eservice.name,
    description: eservice.description,
    technology: eservice.technology,
    version: latestNonDraftDescriptor.version,
    attributes: descriptorAttributes,
    state: latestNonDraftDescriptor.state,
    serverUrls: latestNonDraftDescriptor.serverUrls,
    producer: producerOrganization,
  };
}
