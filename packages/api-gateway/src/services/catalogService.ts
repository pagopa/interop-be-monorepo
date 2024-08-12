import { apiGatewayApi, catalogApi } from "pagopa-interop-api-clients";
import { isDefined, WithLogger } from "pagopa-interop-commons";
import {
  AttributeProcessClient,
  CatalogProcessClient,
  TenantProcessClient,
} from "../clients/clientsProvider.js";
import { ApiGatewayAppContext } from "../utilities/context.js";
import {
  toApiGatewayCatalogEservice,
  toApiGatewayEserviceAttributes,
} from "../api/catalogApiConverter.js";
import { toApiGatewayOrganization } from "../api/tenantApiConverter.js";
import {
  assertAvailableDescriptorExists,
  assertDescriptorStateNotDraft,
} from "./validators.js";
import { getAllBulkAttributes } from "./attributeService.js";

export async function enhanceEservice(
  tenantProcessClient: TenantProcessClient,
  attributeProcessClient: AttributeProcessClient,
  headers: ApiGatewayAppContext["headers"],
  eservice: catalogApi.EService
): Promise<apiGatewayApi.EService> {
  // TODO  CHECK IF IT MAKES SENSE TO MOVE STUFF TO DEDICATED FUNCTIONS
  const producerTenant = await tenantProcessClient.tenant.getTenant({
    headers,
    params: {
      id: eservice.producerId,
    },
  });

  const latestAvailableDescriptor = eservice.descriptors
    .filter((d) => d.state === catalogApi.EServiceDescriptorState.Values.DRAFT)
    .sort((a, b) => Number(a.version) - Number(b.version))
    .at(-1);

  assertAvailableDescriptorExists(latestAvailableDescriptor, eservice.id);
  assertDescriptorStateNotDraft(
    latestAvailableDescriptor.state,
    eservice.id,
    latestAvailableDescriptor.id
  );

  const allDescriptorAttributesIds = [
    ...latestAvailableDescriptor.attributes.certified.flat(),
    ...latestAvailableDescriptor.attributes.verified.flat(),
    ...latestAvailableDescriptor.attributes.declared.flat(),
  ].map((a) => a.id);

  const allRegistryAttributes = await getAllBulkAttributes(
    attributeProcessClient,
    headers,
    allDescriptorAttributesIds
  );

  const descriptorAttributes = toApiGatewayEserviceAttributes(
    latestAvailableDescriptor.attributes,
    allRegistryAttributes
  );

  // Extract category IPA TODO move to dedicated function
  const tenantCertifiedAttributesIds = producerTenant.attributes
    .map((atts) => atts.certified)
    .filter(isDefined)
    .map((a) => a.id);

  const tenantCertifiedAttributes = await Promise.all(
    tenantCertifiedAttributesIds.map((attributeId) =>
      attributeProcessClient.getAttributeById({
        headers,
        params: { attributeId },
      })
    )
  );
  const categoryIpaAttribute = tenantCertifiedAttributes.find(
    (a) => a.origin === "IPA"
  );
  const categoryIpaAttributeName = categoryIpaAttribute
    ? categoryIpaAttribute.name
    : "Unknown";

  return {
    id: eservice.id,
    name: eservice.name,
    description: eservice.description,
    technology: eservice.technology,
    version: latestAvailableDescriptor.version,
    attributes: descriptorAttributes,
    state: latestAvailableDescriptor.state,
    serverUrls: latestAvailableDescriptor.serverUrls,
    producer: toApiGatewayOrganization(
      producerTenant,
      categoryIpaAttributeName
    ),
  };
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
      eserviceId: string
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
  };
}
