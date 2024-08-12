import { apiGatewayApi, catalogApi } from "pagopa-interop-api-clients";

export function toApiGatewayCatalogEservice(
  eservice: catalogApi.EService
): apiGatewayApi.CatalogEService {
  return {
    id: eservice.id,
    name: eservice.name,
    description: eservice.description,
  };
}
