import { apiGatewayApi, tenantApi } from "pagopa-interop-api-clients";
import { isDefined, WithLogger } from "pagopa-interop-commons";
import { toApiGatewayOrganization } from "../api/tenantApiConverter.js";
import {
  TenantProcessClient,
  AttributeProcessClient,
} from "../clients/clientsProvider.js";
import { ApiGatewayAppContext } from "../utilities/context.js";

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
  attributeProcessClient: AttributeProcessClient
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
  };
}
