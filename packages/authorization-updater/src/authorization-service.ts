/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { pluginToken } from "@zodios/plugins";
import { buildInteropTokenGenerator, getContext } from "pagopa-interop-commons";
import { DescriptorId, EServiceId } from "pagopa-interop-models";
import { buildAuthMgmtClient } from "./authorization-management-client.js";
import { ApiClientComponentState } from "./model/models.js";

export const authorizationServiceBuilder = () => {
  const authMgmtClient = buildAuthMgmtClient();
  const tokenGenerator = buildInteropTokenGenerator();

  authMgmtClient.use(
    pluginToken({
      getToken: async () => {
        const token = await tokenGenerator.generateInternalToken();
        return token.serialized;
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

      return await authMgmtClient.updateEServiceState(
        clientEServiceDetailsUpdate,
        {
          params: { eserviceId },
          withCredentials: true,
          headers: getHeaders(),
        }
      );
    },
  };
};

export type AuthorizationService = ReturnType<
  typeof authorizationServiceBuilder
>;
