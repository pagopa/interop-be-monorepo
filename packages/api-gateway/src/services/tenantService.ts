import { apiGatewayApi, tenantApi } from "pagopa-interop-api-clients";
import { isDefined, WithLogger } from "pagopa-interop-commons";
import { operationForbidden } from "pagopa-interop-models";
import {
  toApiGatewayOrganization,
  toM2MTenantSeed,
} from "../api/tenantApiConverter.js";
import {
  TenantProcessClient,
  AttributeProcessClient,
  PagoPAInteropBeClients,
} from "../clients/clientsProvider.js";
import { ApiGatewayAppContext } from "../utilities/context.js";
import { clientStatusCodeToError } from "../clients/catchClientError.js";
import {
  attributeByCodeNotFound,
  attributeByOriginNotFound,
  certifiedAttributeAlreadyAssigned,
  tenantAttributeNotFound,
  tenantByOriginNotFound,
  tenantNotFound,
} from "../models/errors.js";
import { enhanceEservice, getAllEservices } from "./catalogService.js";

export async function getOrganization(
  tenantProcessClient: TenantProcessClient,
  attributeProcessClient: AttributeProcessClient,
  headers: ApiGatewayAppContext["headers"],
  tenantId: tenantApi.Tenant["id"]
): Promise<apiGatewayApi.Organization> {
  const tenant = await tenantProcessClient.tenant.getTenant({
    headers,
    params: {
      id: tenantId,
    },
  });

  const tenantCertifiedAttributesIds = tenant.attributes
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

  return toApiGatewayOrganization(tenant, tenantCertifiedAttributes);
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantServiceBuilder(clients: PagoPAInteropBeClients) {
  return {
    getOrganization: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      tenantId: tenantApi.Tenant["id"]
    ): Promise<apiGatewayApi.Organization> => {
      logger.info(`Retrieving tenant ${tenantId}`);

      return getOrganization(
        clients.tenantProcessClient,
        clients.attributeProcessClient,
        headers,
        tenantId
      ).catch((res) => {
        throw clientStatusCodeToError(res, {
          404: tenantNotFound(tenantId),
        });
      });
    },
    getOrganizationEservices: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      params: {
        origin: tenantApi.ExternalId["origin"];
        externalId: tenantApi.ExternalId["value"];
        attributeOrigin: string;
        attributeCode: string;
      }
    ): Promise<apiGatewayApi.EServices> => {
      const { origin, externalId, attributeOrigin, attributeCode } = params;
      logger.info(
        `Retrieving Organization EServices for origin ${origin} externalId ${externalId} attributeOrigin ${attributeOrigin} attributeCode ${attributeCode}`
      );

      const tenant = await clients.tenantProcessClient.tenant
        .getTenantByExternalId({
          headers,
          params: {
            origin,
            code: externalId,
          },
        })
        .catch((res) => {
          throw clientStatusCodeToError(res, {
            404: tenantByOriginNotFound(origin, externalId),
          });
        });

      const attribute = await clients.attributeProcessClient
        .getAttributeByOriginAndCode({
          headers,
          params: {
            origin: attributeOrigin,
            code: attributeCode,
          },
        })
        .catch((res) => {
          throw clientStatusCodeToError(res, {
            404: attributeByOriginNotFound(attributeOrigin, attributeCode),
          });
        });

      const allEservices = await getAllEservices(
        clients.catalogProcessClient,
        headers,
        tenant.id,
        attribute.id
      );
      const allowedEservices = allEservices.filter(
        (eservice) => eservice.descriptors.length > 0
      );

      const eservices = await Promise.all(
        allowedEservices.map((eservice) =>
          enhanceEservice(
            clients.tenantProcessClient,
            clients.attributeProcessClient,
            headers,
            eservice,
            logger
          )
        )
      );
      return { eservices };
    },
    revokeTenantAttribute: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      params: {
        origin: tenantApi.ExternalId["origin"];
        externalId: tenantApi.ExternalId["value"];
        attributeCode: tenantApi.M2MAttributeSeed["code"];
      }
    ): Promise<void> => {
      const { origin, externalId, attributeCode } = params;
      logger.info(
        `Revoking attribute ${attributeCode} of tenant (${origin},${externalId})`
      );

      await clients.tenantProcessClient.m2m
        .m2mRevokeAttribute(undefined, {
          headers,
          params: {
            origin,
            externalId,
            code: attributeCode,
          },
        })
        .catch((res) => {
          throw clientStatusCodeToError(res, {
            403: operationForbidden,
            404: tenantByOriginNotFound(origin, externalId),
            400: tenantAttributeNotFound(origin, externalId, attributeCode),
          });
        });
    },
    upsertTenant: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      params: {
        origin: tenantApi.ExternalId["origin"];
        externalId: tenantApi.ExternalId["value"];
        attributeCode: tenantApi.M2MAttributeSeed["code"];
      }
    ): Promise<void> => {
      const { origin, externalId, attributeCode } = params;
      logger.info(
        `Upserting tenant with externalId (${origin},${externalId}) with attribute ${attributeCode}`
      );

      const tenantSeed = toM2MTenantSeed(origin, externalId, attributeCode);

      const tenant: tenantApi.Tenant | undefined =
        await clients.tenantProcessClient.tenant
          .getTenantByExternalId({
            headers,
            params: {
              origin,
              code: externalId,
            },
          })
          .catch(() => undefined);
      await clients.tenantProcessClient.m2m
        .m2mUpsertTenant(tenantSeed, {
          headers,
        })
        .catch((res) => {
          throw clientStatusCodeToError(res, {
            403: operationForbidden,
            404:
              tenant === undefined
                ? tenantByOriginNotFound(origin, externalId)
                : attributeByCodeNotFound(attributeCode),
            409: certifiedAttributeAlreadyAssigned(
              origin,
              externalId,
              attributeCode
            ),
          });
        });
    },
  };
}

export type TenantService = ReturnType<typeof tenantServiceBuilder>;
