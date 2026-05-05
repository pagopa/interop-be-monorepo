import { authorizationApi, apiGatewayApi } from "pagopa-interop-api-clients";
import { M2MAuthData, WithLogger } from "pagopa-interop-commons";
import { ClientJWKKey } from "pagopa-interop-models";
import { ApiGatewayAppContext } from "../utilities/context.js";
import { toApiGatewayClient } from "../api/authorizationApiConverter.js";
import { clientNotFound, keyNotFound } from "../models/errors.js";
import { clientStatusCodeToError } from "../clients/catchClientError.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function authorizationServiceBuilder(
  authorizationProcessClient: Pick<
    authorizationApi.AuthorizationProcessClient,
    "client"
  >,
  readModelService: ReadModelServiceSQL
) {
  return {
    getClient: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext<M2MAuthData>>,
      clientId: authorizationApi.Client["id"]
    ): Promise<apiGatewayApi.Client> => {
      logger.info(`Retrieving Client ${clientId}`);

      const client = await authorizationProcessClient.client
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
