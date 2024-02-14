/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { pluginToken } from "@zodios/plugins";
import { getContext } from "pagopa-interop-commons";
import { DescriptorId, EServiceId } from "pagopa-interop-models";
import { buidAuthMgmtClient } from "./authorization-management-client.js";
import { ApiClientComponentState } from "./model/models.js";

export const authorizationServiceBuilder = () => {
  const apiClient = buidAuthMgmtClient();
  apiClient.use(
    pluginToken({
      // TODO: retrieve token from builder
      getToken: async () => undefined,
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

      return await apiClient.updateEServiceState(clientEServiceDetailsUpdate, {
        params: { eserviceId },
        withCredentials: true,
        headers: getHeaders(),
      });
    },
  };
};

export type AuthorizationService = ReturnType<
  typeof authorizationServiceBuilder
>;
