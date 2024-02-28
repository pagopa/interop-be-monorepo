/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { pluginToken } from "@zodios/plugins";
import {
  buildInteropTokenGenerator,
  getContext,
  logger,
} from "pagopa-interop-commons";
import { DescriptorId, EServiceId } from "pagopa-interop-models";
import { buildAuthMgmtClient } from "./authorization-management-client.js";
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

export const authorizationServiceBuilder = async () => {
  const authMgmtClient = buildAuthMgmtClient();
  const tokenGenerator = buildInteropTokenGenerator();
  const token = await tokenGenerator.generateInternalToken();

  authMgmtClient.use(
    pluginToken({
      getToken: async () => token.serialized,
      renewToken: async () => {
        logger.info("Renewing token");

        const newToken = await tokenGenerator.generateInternalToken();
        return newToken.serialized;
      },
    })
  );

  const getHeaders = () => {
    const appContext = getContext();
    return {
      "X-Correlation-Id": appContext.correlationId,
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

      logger.info(`Authorization service update Eservice state`);
    },
  };
};
