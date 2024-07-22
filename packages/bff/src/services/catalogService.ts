/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { WithLogger } from "pagopa-interop-commons";
import { catalogApi, tenantApi, bffApi } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";
import { EServiceId } from "pagopa-interop-models";
import { toBffCatalogApiEServiceResponse } from "../model/api/apiConverter.js";
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
      catalogApi.EServiceDescriptorState.Values.PUBLISHED,
      catalogApi.EServiceDescriptorState.Values.SUSPENDED,
      catalogApi.EServiceDescriptorState.Values.DEPRECATED,
      () => true
    )
    .with(
      catalogApi.EServiceDescriptorState.Values.DRAFT,
      catalogApi.EServiceDescriptorState.Values.ARCHIVED,
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
    updateEServiceDescription: async (
      headers: Headers,
      eServiceId: EServiceId,
      updateSeed: bffApi.EServiceDescriptionSeed
    ): Promise<bffApi.CreatedResource> => {
      const updatedEservice =
        await catalogProcessClient.updateEServiceDescription(updateSeed, {
          headers,
          params: {
            eServiceId,
          },
        });

      return {
        id: updatedEservice.id,
      };
    },
  };
}
