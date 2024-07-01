/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { WithLogger } from "pagopa-interop-commons";
import {
  BffCatalogApiEServiceResponse,
  BffGetCatalogApiHeaders,
  BffGetCatalogApiResponse,
} from "../model/api/bffTypes.js";

import {
  CatalogProcessApiEService,
  CatalogProcessApiEServiceDescriptor,
  CatalogProcessApiEServicesResponse,
  CatalogProcessApiQueryParam,
  descriptorApiState,
} from "../model/api/catalogTypes.js";

import { TenantProcessApiTenant } from "../model/api/tenantTypes.js";


import { toBffCatalogApiEServiceResponse } from "../model/api/apiConverter.js";
import { catalogProcessApiEServiceDescriptorCertifiedAttributesSatisfied } from "../model/validators.js";
import {
  AgreementProcessClient,
  CatalogProcessClient,
  TenantProcessClient,
} from "../providers/clientProvider.js";
import { BffAppContext } from "../utilities/context.js";
import { getLatestAgreement } from "./agreementService.js";

const ACTIVE_DESCRIPTOR_STATES_FILTER = [
  descriptorApiState.PUBLISHED,
  descriptorApiState.SUSPENDED,
  descriptorApiState.DEPRECATED,
];

export type CatalogService = ReturnType<typeof catalogServiceBuilder>;

const enhanceCatalogEService =
  (
    tenantProcessClient: TenantProcessClient,
    agreementProcessClient: AgreementProcessClient,
    headers: BffGetCatalogApiHeaders,
    requesterId: string
  ): ((
    eservice: CatalogProcessApiEService
  ) => Promise<BffCatalogApiEServiceResponse>) =>
  async (
    eservice: CatalogProcessApiEService
  ): Promise<BffCatalogApiEServiceResponse> => {
    const producerTenant = await tenantProcessClient.getTenant({
      headers,
      params: {
        id: eservice.producerId,
      },
    });

    const requesterTenant: TenantProcessApiTenant =
      requesterId !== eservice.producerId
        ? await tenantProcessClient.getTenant({
            headers,
            params: {
              id: requesterId,
            },
          })
        : producerTenant;

    const latestActiveDescriptor:
      | CatalogProcessApiEServiceDescriptor
      | undefined = eservice.descriptors
      .filter((d) => ACTIVE_DESCRIPTOR_STATES_FILTER.includes(d.state))
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
      queries: CatalogProcessApiQueryParam
    ): Promise<BffGetCatalogApiResponse> => {
      const requesterId = context.authData.organizationId;
      const { offset, limit } = queries;
      const eservicesResponse: CatalogProcessApiEServicesResponse =
        await catalogProcessClient.getEServices({
          headers: context.headers,
          queries,
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
      const response: BffGetCatalogApiResponse = {
        results,
        pagination: {
          offset,
          limit,
          totalCount: eservicesResponse.totalCount,
        },
      };

      return response;
    },
  };
}
