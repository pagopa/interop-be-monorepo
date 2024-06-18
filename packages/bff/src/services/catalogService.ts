/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  AgreementProcessApiResponse,
  AgreementProcessApiAgreement,
  agreementApiState,
} from "../model/api/agreementTypes.js";
import {
  BffCatalogApiResponse,
  BffCatalogApiEServiceResponse,
} from "../model/api/bffTypes.js";

import {
  EServiceCatalogProcessApi,
  EServicesCatalogProcessApiResponse,
  descriptorApiState,
  EServiceCatalogProcessApiDescriptor,
  CatalogProcessApiQueryParam,
} from "../model/api/catalogTypes.js";

import { TenantProcessApiResponse } from "../model/api/tenantTypes.js";

import {
  AgreementProcessClient,
  CatalogProcessClient,
  TenantProcessClient,
} from "../providers/clientProvider.js";
import { certifiedAttributesSatisfied } from "../model/validators.js";

const ACTIVE_DESCRIPTOR_STATES_FILTER = [
  descriptorApiState.DRAFT,
  descriptorApiState.SUSPENDED,
  descriptorApiState.DEPRECATED,
];

export type CatalogService = ReturnType<typeof catalogServiceBuilder>;

const getAllAgreements = async (
  agreementProcessClient: AgreementProcessClient,
  consumerId: string,
  eserviceId: string,
  headers: { "X-Correlation-Id": string }
): Promise<AgreementProcessApiAgreement[]> => {
  const getAgreementsFrom = async (
    start: number
  ): Promise<AgreementProcessApiResponse> =>
    await agreementProcessClient.getAgreements({
      headers,
      queries: {
        consumersIds: [consumerId],
        eservicesIds: [eserviceId],
        offset: start,
        limit: 50,
      },
    });

  // Fetched all agreements in a recursive way
  const getAgreements = async (
    start: number
  ): Promise<AgreementProcessApiAgreement[]> => {
    const agreements = (await getAgreementsFrom(start)).results;

    if (agreements.length >= 50) {
      return agreements.concat(await getAgreements(start + 50));
    }
    return agreements;
  };

  return await getAgreements(0);
};

const isUpgradable = (
  eservice: EServiceCatalogProcessApi,
  agreement: AgreementProcessApiAgreement
): boolean => {
  const eserviceDescriptor = eservice.descriptors.find(
    (e) => e.id === agreement.descriptorId
  );

  return (
    eserviceDescriptor !== undefined &&
    eservice.descriptors
      .filter(
        (d) =>
          parseInt(d.version, 10) > parseInt(eserviceDescriptor.version, 10)
      )
      .find(
        (d) =>
          (d.state === descriptorApiState.PUBLISHED ||
            d.state === descriptorApiState.SUSPENDED) &&
          (agreement.state === agreementApiState.ACTIVE ||
            agreement.state === agreementApiState.SUSPENDED)
      ) !== undefined
  );
};

const enhanceCatalogEService =
  (
    tenantProcessClient: TenantProcessClient,
    agreementProcessClient: AgreementProcessClient,
    correlationId: string,
    requesterId: string
  ): ((
    eservice: EServiceCatalogProcessApi
  ) => Promise<BffCatalogApiEServiceResponse>) =>
  async (
    eservice: EServiceCatalogProcessApi
  ): Promise<BffCatalogApiEServiceResponse> => {
    const headers = { "X-Correlation-Id": correlationId };
    const producerTenant = await tenantProcessClient.getTenant({
      headers,
      params: {
        id: eservice.producerId,
      },
    });

    const requesterTenant: TenantProcessApiResponse =
      requesterId !== eservice.producerId
        ? await tenantProcessClient.getTenant({
            headers,
            params: {
              id: requesterId,
            },
          })
        : producerTenant;

    const activeDescriptor: EServiceCatalogProcessApiDescriptor | undefined =
      eservice.descriptors
        .filter((d) => ACTIVE_DESCRIPTOR_STATES_FILTER.includes(d.state))
        .sort((a, b) => parseInt(a.version, 10) - parseInt(b.version, 10))
        .at(-1);

    const agreements = await getAllAgreements(
      agreementProcessClient,
      requesterId,
      eservice.id,
      headers
    );
    const latestAgreement = agreements.length > 0 ? agreements[0] : null;

    if (!latestAgreement) {
      // TODO : improve error handling
      throw new Error("No agreement found");
    }

    const canBeUpgraded = isUpgradable(eservice, latestAgreement);

    const hasCertifiedAttributes =
      activeDescriptor !== undefined &&
      certifiedAttributesSatisfied(activeDescriptor, requesterTenant);

    return {
      id: eservice.id,
      name: eservice.name,
      description: eservice.description,
      producer: {
        id: eservice.producerId,
        name: producerTenant.name,
      },
      agreement: {
        id: latestAgreement.id,
        state: latestAgreement.state,
        canBeUpgraded,
      },
      isMine: requesterId === eservice.producerId,
      hasCertifiedAttributes,
      activeDescriptor: activeDescriptor
        ? {
            id: activeDescriptor.id,
            version: activeDescriptor.version,
            audience: activeDescriptor.audience,
            state: activeDescriptor.state,
          }
        : undefined,
    };
  };

export function catalogServiceBuilder(
  catalogProcessClient: CatalogProcessClient,
  tenantProcessClient: TenantProcessClient,
  agreementProcessClient: AgreementProcessClient
) {
  return {
    getCatalog: async (
      correlationId: string,
      requesterId: string,
      queries: CatalogProcessApiQueryParam
    ): Promise<BffCatalogApiResponse> => {
      const { offset, limit } = queries;

      const eservicesResponse: EServicesCatalogProcessApiResponse =
        await catalogProcessClient.getEServices({
          headers: {
            "X-Correlation-Id": correlationId,
          },
          queries,
        });

      const results = await Promise.all(
        eservicesResponse.results.map(
          enhanceCatalogEService(
            tenantProcessClient,
            agreementProcessClient,
            correlationId,
            requesterId
          )
        )
      );
      const response: BffCatalogApiResponse = {
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
