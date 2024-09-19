import { apiGatewayApi, tenantApi } from "pagopa-interop-api-clients";
import { isDefined } from "pagopa-interop-commons";
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
