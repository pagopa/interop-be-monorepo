import { authorizationApi, apiGatewayApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import {
  ClientJWKKey,
  operationForbidden,
  TenantId,
} from "pagopa-interop-models";
import {
  AuthorizationProcessClient,
  CatalogProcessClient,
  PurposeProcessClient,
} from "../clients/clientsProvider.js";
import { ApiGatewayAppContext } from "../utilities/context.js";
import { toApiGatewayClient } from "../api/authorizationApiConverter.js";
import { keyNotFound } from "../models/errors.js";
import { readModelServiceBuilder } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function authorizationServiceBuilder(
  authorizationProcessClient: AuthorizationProcessClient,
  purposeProcessClient: PurposeProcessClient,
  catalogProcessClient: CatalogProcessClient,
  readModelService: ReturnType<typeof readModelServiceBuilder>
) {
  return {
    getClient: async (
      {
        logger,
        headers,
        authData: { organizationId },
      }: WithLogger<ApiGatewayAppContext>,
      clientId: authorizationApi.Client["id"]
    ): Promise<apiGatewayApi.Client> => {
      logger.info(`Retrieving Client ${clientId}`);

      const client = await authorizationProcessClient.client.getClient({
        headers,
        params: {
          clientId,
        },
      });

      const isAllowed = await isAllowedToGetClient(
        purposeProcessClient,
        catalogProcessClient,
        headers,
        organizationId,
        client
      );

      if (!isAllowed) {
        throw operationForbidden;
      }

      return toApiGatewayClient(client);
    },
    getJWK: async (
      { logger }: WithLogger<ApiGatewayAppContext>,
      kId: ClientJWKKey["kid"]
    ): Promise<apiGatewayApi.JWK> => {
      logger.info(`Retrieving JWK of key with kId: ${kId}`);

      const jwk = await readModelService.getJWKById(kId);
      if (!jwk) {
        throw keyNotFound(kId);
      }

      return jwk;
    },
  };
}

async function isAllowedToGetClient(
  purposeProcessClient: PurposeProcessClient,
  catalogProcessClient: CatalogProcessClient,
  headers: ApiGatewayAppContext["headers"],
  requesterId: TenantId,
  client: authorizationApi.Client
): Promise<boolean> {
  if (client.consumerId === requesterId) {
    return true;
  }

  const purposes = await Promise.all(
    client.purposes.map((purpose) =>
      purposeProcessClient.getPurpose({
        headers,
        params: {
          id: purpose,
        },
      })
    )
  );

  const eservices = await Promise.all(
    purposes.map((purpose) =>
      catalogProcessClient.getEServiceById({
        headers,
        params: {
          eServiceId: purpose.eserviceId,
        },
      })
    )
  );

  return eservices.some((eservice) => eservice.producerId === requesterId);
}
