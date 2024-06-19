/* eslint-disable max-params */
import { IncomingHttpHeaders } from "http";
import { match, P } from "ts-pattern";
import { v4 as uuidv4 } from "uuid";
import {
  AgreementProcessApiAgreement,
  agreementApiState,
} from "./agreementTypes.js";
import {
  BffCatalogApiEServiceResponse,
  BffGetCatalogApiHeaders,
  BffGetCatalogApiQueryParam,
} from "./bffTypes.js";
import {
  CatalogProcessApiQueryParam,
  EServiceCatalogProcessApi,
  EServiceCatalogProcessApiDescriptor,
  descriptorApiState,
} from "./catalogTypes.js";
import { TenantProcessApiResponse } from "./tenantTypes.js";

export function parseHeaders(
  headers: IncomingHttpHeaders
): BffGetCatalogApiHeaders {
  return match(headers)
    .with({ "X-Correlation-Id": P.string }, (headers) => headers)
    .otherwise(() => ({
      /* 
        Otherwise case should never happen anyway this implements gurantee 
        the same behavior of contextMiddleware: 
        https://github.com/pagopa/interop-be-monorepo/blob/7dcbbae8f0e7cb385c5977a0304101bd1281cefb/packages/commons/src/context/context.ts#L28
      */
      ...headers,
      "X-Correlation-Id": uuidv4(),
    }));
}

export function toEserviceCatalogProcessQueryParams(
  queryParams: BffGetCatalogApiQueryParam
): CatalogProcessApiQueryParam {
  return {
    ...queryParams,
    producersIds: queryParams.producersIds
      ? queryParams.producersIds[0]
      : undefined,
    states: queryParams.states ? queryParams.states[0] : undefined,
    attributesIds: queryParams.attributesIds
      ? queryParams.attributesIds[0]
      : undefined,
    agreementStates: queryParams.agreementStates
      ? queryParams.agreementStates[0]
      : undefined,
  };
}

export function toBffCatalogApiEServiceResponse(
  eservice: EServiceCatalogProcessApi,
  producerTenant: TenantProcessApiResponse,
  hasCertifiedAttributes: boolean,
  isRequesterEqProducer: boolean,
  activeDescriptor?: EServiceCatalogProcessApiDescriptor,
  agreement?: AgreementProcessApiAgreement
): BffCatalogApiEServiceResponse {
  const isUpgradable = (agreement: AgreementProcessApiAgreement): boolean => {
    const eserviceDescriptor = eservice.descriptors.find(
      (e) => e.id === agreement.descriptorId
    );

    return (
      eserviceDescriptor !== undefined &&
      eservice.descriptors
        .filter((d) => Number(d.version) > Number(eserviceDescriptor.version))
        .find(
          (d) =>
            (d.state === descriptorApiState.PUBLISHED ||
              d.state === descriptorApiState.SUSPENDED) &&
            (agreement.state === agreementApiState.ACTIVE ||
              agreement.state === agreementApiState.SUSPENDED)
        ) !== undefined
    );
  };

  const partialEnhancedEservice = {
    id: eservice.id,
    name: eservice.name,
    description: eservice.description,
    producer: {
      id: eservice.producerId,
      name: producerTenant.name,
    },
    isMine: isRequesterEqProducer,
    hasCertifiedAttributes,
  };

  return {
    ...partialEnhancedEservice,
    ...(activeDescriptor
      ? {
          activeDescriptor: {
            id: activeDescriptor.id,
            version: activeDescriptor.version,
            audience: activeDescriptor.audience,
            state: activeDescriptor.state,
          },
        }
      : {}),
    ...(agreement
      ? {
          agreement: {
            id: agreement.id,
            state: agreement.state,
            canBeUpgraded: isUpgradable(agreement),
          },
        }
      : {}),
  };
}
