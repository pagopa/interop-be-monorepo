import { catalogApi, m2mGatewayApi } from "pagopa-interop-api-clients";

export function toM2MGatewayApiEService(
  eservice: catalogApi.EService
): m2mGatewayApi.EService {
  return {
    id: eservice.id,
    producerId: eservice.producerId,
    name: eservice.name,
    description: eservice.description,
    technology: eservice.technology,
    mode: eservice.mode,
    isSignalHubEnabled: eservice.isSignalHubEnabled,
    isConsumerDelegable: eservice.isConsumerDelegable,
    isClientAccessDelegable: eservice.isClientAccessDelegable,
    templateId: eservice.templateId,
  };
}
