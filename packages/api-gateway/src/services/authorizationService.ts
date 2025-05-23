import { authorizationApi, apiGatewayApi } from "pagopa-interop-api-clients";
import { M2MAuthData, WithLogger } from "pagopa-interop-commons";
import {
  ClientJWKKey,
  operationForbidden,
  TenantId,
} from "pagopa-interop-models";
import {
  CatalogProcessClient,
  PagoPAInteropBeClients,
  PurposeProcessClient,
} from "../clients/clientsProvider.js";
import { ApiGatewayAppContext } from "../utilities/context.js";
import { toApiGatewayClient } from "../api/authorizationApiConverter.js";
import { clientNotFound, keyNotFound } from "../models/errors.js";
import { clientStatusCodeToError } from "../clients/catchClientError.js";
import { ReadModelService } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function authorizationServiceBuilder(
  clients: PagoPAInteropBeClients,
  readModelService: ReadModelService
) {
  return {
    getClient: async (
      {
        logger,
        headers,
        authData: { organizationId },
      }: WithLogger<ApiGatewayAppContext<M2MAuthData>>,
      clientId: authorizationApi.Client["id"]
    ): Promise<apiGatewayApi.Client> => {
      logger.info(`Retrieving Client ${clientId}`);

      const client = await clients.authorizationProcessClient.client
        .getClient({
          headers,
          params: {
            clientId,
          },
        })
        .catch((res) => {
          throw clientStatusCodeToError(res, {
            404: clientNotFound(clientId),
          });
        });

      const isAllowed = await isAllowedToGetClient(
        clients.purposeProcessClient,
        clients.catalogProcessClient,
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

export type AuthorizationService = ReturnType<
  typeof authorizationServiceBuilder
>;

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
