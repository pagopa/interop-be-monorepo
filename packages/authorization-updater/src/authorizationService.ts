/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { pluginToken } from "@zodios/plugins";
import {
  buildInteropTokenGenerator,
  getContext,
  jwtSeedConfig,
  logger,
} from "pagopa-interop-commons";
import { v4 } from "uuid";
import { DescriptorId, EServiceId } from "pagopa-interop-models";
import { buildAuthMgmtClient } from "./authorizationManagementClient.js";
import { ApiClientComponentState } from "./model/models.js";

export type AuthorizationService = {
  updateEServiceState: (
    state: ApiClientComponentState,
    descriptorId: DescriptorId,
    eserviceId: EServiceId,
    audience: string[],
    voucherLifespan: number
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

    const getHeaders = () => {
      const appContext = getContext();
      return {
        "X-Correlation-Id": appContext.correlationId || v4(),
      };
    };

    return {
      async updateEServiceState(
        state: ApiClientComponentState,
        descriptorId: DescriptorId,
        eserviceId: EServiceId,
        audience: string[],
        voucherLifespan: number
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
          headers: getHeaders(),
        });

        logger.info(`Updating EService ${eserviceId} state for all clients`);
      },
    };
  };
