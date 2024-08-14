import { apiGatewayApi, tenantApi } from "pagopa-interop-api-clients";
import { isDefined, WithLogger } from "pagopa-interop-commons";
import { toApiGatewayOrganization } from "../api/tenantApiConverter.js";
import {
  TenantProcessClient,
  AttributeProcessClient,
  CatalogProcessClient,
} from "../clients/clientsProvider.js";
import { ApiGatewayAppContext } from "../utilities/context.js";
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
export function tenantServiceBuilder(
  tenantProcessClient: TenantProcessClient,
  attributeProcessClient: AttributeProcessClient,
  catalogProcessClient: CatalogProcessClient
) {
  return {
    getOrganization: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      tenantId: tenantApi.Tenant["id"]
    ): Promise<apiGatewayApi.Organization> => {
      logger.info(`Retrieving tenant ${tenantId}`);

      return getOrganization(
        tenantProcessClient,
        attributeProcessClient,
        headers,
        tenantId
      );
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

      const tenant = await tenantProcessClient.tenant.getTenantByExternalId({
        headers,
        params: {
          origin,
          code: externalId,
        },
      });

      const attribute =
        await attributeProcessClient.getAttributeByOriginAndCode({
          headers,
          params: {
            origin: attributeOrigin,
            code: attributeCode,
          },
        });

      const allEservices = await getAllEservices(
        catalogProcessClient,
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
            tenantProcessClient,
            attributeProcessClient,
            headers,
            eservice
          )
        )
      );
      return { eservices };
    },
  };
}
