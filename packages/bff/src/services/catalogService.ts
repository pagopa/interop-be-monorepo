/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi, catalogApi, tenantApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { EServiceId } from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  toBffCatalogApiEServiceResponse,
  toCatalogEServiceSeed,
} from "../model/api/apiConverter.js";
import { catalogApiDescriptorState } from "../model/api/apiTypes.js";
import { catalogProcessApiEServiceDescriptorCertifiedAttributesSatisfied } from "../model/validators.js";
import {
  AgreementProcessClient,
  CatalogProcessClient,
  TenantProcessClient,
} from "../providers/clientProvider.js";
import { BffAppContext, Headers } from "../utilities/context.js";
import { getLatestAgreement } from "./agreementService.js";

function activeDescriptorStateFilter(
  descriptor: catalogApi.EServiceDescriptor
): boolean {
  return match(descriptor.state)
    .with(
      catalogApiDescriptorState.PUBLISHED,
      catalogApiDescriptorState.SUSPENDED,
      catalogApiDescriptorState.DEPRECATED,
      () => true
    )
    .with(
      catalogApiDescriptorState.DRAFT,
      catalogApiDescriptorState.ARCHIVED,
      () => false
    )
    .exhaustive();
}

export type CatalogService = ReturnType<typeof catalogServiceBuilder>;

const enhanceCatalogEService =
  (
    tenantProcessClient: TenantProcessClient,
    agreementProcessClient: AgreementProcessClient,
    headers: Headers,
    requesterId: string
  ): ((eservice: catalogApi.EService) => Promise<bffApi.CatalogEService>) =>
  async (eservice: catalogApi.EService): Promise<bffApi.CatalogEService> => {
    const producerTenant = await tenantProcessClient.tenant.getTenant({
      headers,
      params: {
        id: eservice.producerId,
      },
    });

    const requesterTenant: tenantApi.Tenant =
      requesterId !== eservice.producerId
        ? await tenantProcessClient.tenant.getTenant({
            headers,
            params: {
              id: requesterId,
            },
          })
        : producerTenant;

    const latestActiveDescriptor: catalogApi.EServiceDescriptor | undefined =
      eservice.descriptors
        .filter(activeDescriptorStateFilter)
        .sort((a, b) => Number(a.version) - Number(b.version))
        .at(-1);

    const latestAgreement = await getLatestAgreement(
      agreementProcessClient,
      requesterId,
      eservice,
      headers
    );

    const isRequesterEqProducer = requesterId === eservice.producerId;
    const hasCertifiedAttributes =
      latestActiveDescriptor !== undefined &&
      catalogProcessApiEServiceDescriptorCertifiedAttributesSatisfied(
        latestActiveDescriptor,
        requesterTenant
      );

    return toBffCatalogApiEServiceResponse(
      eservice,
      producerTenant,
      hasCertifiedAttributes,
      isRequesterEqProducer,
      latestActiveDescriptor,
      latestAgreement
    );
  };

export function catalogServiceBuilder(
  catalogProcessClient: CatalogProcessClient,
  tenantProcessClient: TenantProcessClient,
  agreementProcessClient: AgreementProcessClient
) {
  return {
    getCatalog: async (
      context: WithLogger<BffAppContext>,
      queries: catalogApi.GetCatalogQueryParam
    ): Promise<bffApi.CatalogEServices> => {
      const requesterId = context.authData.organizationId;
      const { offset, limit } = queries;
      const eservicesResponse: catalogApi.EServices =
        await catalogProcessClient.getEServices({
          headers: context.headers,
          queries: {
            ...queries,
            eservicesIds: queries.eservicesIds,
            producersIds: queries.producersIds,
            states: queries.states,
            attributesIds: queries.attributesIds,
            agreementStates: queries.agreementStates,
          },
        });

      const results = await Promise.all(
        eservicesResponse.results.map(
          enhanceCatalogEService(
            tenantProcessClient,
            agreementProcessClient,
            context.headers,
            requesterId
          )
        )
      );
      const response: bffApi.CatalogEServices = {
        results,
        pagination: {
          offset,
          limit,
          totalCount: eservicesResponse.totalCount,
        },
      };

      return response;
    },
    createEService: async (
      eServiceSeed: bffApi.EServiceSeed,
      { headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      const { id } = await catalogProcessClient.createEService(
        toCatalogEServiceSeed(eServiceSeed),
        {
          headers,
        }
      );
      return { id };
    },
    updateEServiceById: async (
      eServiceId: EServiceId,
      updateEServiceSeed: bffApi.UpdateEServiceSeed,
      { headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      const { id } = await catalogProcessClient.updateEServiceById(
        updateEServiceSeed,
        {
          headers,
          params: {
            eServiceId,
          },
        }
      );
      return { id };
    },
    deleteEService: async (
      eServiceId: EServiceId,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> =>
      await catalogProcessClient.deleteEService(undefined, {
        headers,
        params: {
          eServiceId,
        },
      }),
    updateEServiceDescription: async (
      headers: Headers,
      eServiceId: EServiceId,
      updateSeed: bffApi.EServiceDescriptionSeed
    ): Promise<bffApi.CreatedResource> => {
      const { id } = await catalogProcessClient.updateEServiceDescription(
        updateSeed,
        {
          headers,
          params: {
            eServiceId,
          },
        }
      );
      return { id };
    },
  };
}
