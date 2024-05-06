/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { pluginToken } from "@zodios/plugins";
import {
  buildInteropTokenGenerator,
  jwtSeedConfig,
  logger,
} from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";
import { DescriptorId, EServiceId } from "pagopa-interop-models";
import { buildAuthMgmtClient } from "./authorizationManagementClient.js";
import { ApiClientComponentState } from "./model/models.js";

export type AuthorizationService = {
  updateEServiceState: (
    state: ApiClientComponentState,
    descriptorId: DescriptorId,
    eserviceId: EServiceId,
    audience: string[],
    voucherLifespan: number,
    correlationId: string | undefined | null
  ) => Promise<void>;
};

export const authorizationServiceBuilder =
  async (): Promise<AuthorizationService> => {
    const authMgmtClient = buildAuthMgmtClient();
    const tokenGenerator = buildInteropTokenGenerator();
    const jwtConfig = jwtSeedConfig();

    const tokenPayloadSeed = {
      subject: jwtConfig.subject,
      audience: jwtConfig.audience,
      tokenIssuer: jwtConfig.tokenIssuer,
      expirationInSeconds: jwtConfig.secondsToExpire,
    };
    const token = await tokenGenerator.generateInternalToken(tokenPayloadSeed);

    authMgmtClient.use(
      pluginToken({
        getToken: async () => token.serialized,
        renewToken: async () => {
          /*
            This function is called when the service responds with a 401,
            automatically renews the token, and executes the request again.
            more details: https://github.com/ecyrbe/zodios-plugins/blob/main/src/plugins.test.ts#L69
          */
          logger.info("Renewing token");

          const newToken = await tokenGenerator.generateInternalToken(
            tokenPayloadSeed
          );
          return newToken.serialized;
        },
      })
    );

    const getHeaders = (correlationId: string | undefined | null) => ({
      "X-Correlation-Id": correlationId || uuidv4(),
    });

    return {
      // eslint-disable-next-line max-params
      async updateEServiceState(
        state: ApiClientComponentState,
        descriptorId: DescriptorId,
        eserviceId: EServiceId,
        audience: string[],
        voucherLifespan: number,
        correlationId: string | undefined | null
      ) {
        const clientEServiceDetailsUpdate = {
          state,
          descriptorId,
          audience,
          voucherLifespan,
        };

        await authMgmtClient.updateEServiceState(clientEServiceDetailsUpdate, {
          params: { eserviceId },
          withCredentials: true,
          headers: getHeaders(correlationId),
        });

        logger.info(`Updating EService ${eserviceId} state for all clients`);
      },
    };
  };
