/* eslint-disable max-params */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  InteropTokenGenerator,
  RefreshableInteropToken,
  tokenGenerationConfig,
  Logger,
} from "pagopa-interop-commons";
import { DescriptorId, EServiceId, TenantId } from "pagopa-interop-models";
import { buildAuthMgmtClient } from "./authorizationManagementClient.js";
import { ApiClientComponentState } from "./model/models.js";

export type AuthorizationService = {
  updateEServiceState: (
    state: ApiClientComponentState,
    descriptorId: DescriptorId,
    eserviceId: EServiceId,
    audience: string[],
    voucherLifespan: number,
    logger: Logger,
    correlationId: string
  ) => Promise<void>;

  updateAgreementState: (
    state: ApiClientComponentState,
    agreementId: string,
    eserviceId: EServiceId,
    consumerId: TenantId,
    correlationId: string
  ) => Promise<void>;
};

export const authorizationServiceBuilder =
  async (): Promise<AuthorizationService> => {
    const authMgmtClient = buildAuthMgmtClient();
    const tokenGeneratorConfig = tokenGenerationConfig();
    const tokenGenerator = new InteropTokenGenerator(tokenGeneratorConfig);
    const refreshableToken = new RefreshableInteropToken(tokenGenerator);
    await refreshableToken.init();

    const getHeaders = (correlationId: string, token: string) => ({
      "X-Correlation-Id": correlationId,
      Authorization: `Bearer ${token}`,
    });

    return {
      // eslint-disable-next-line max-params
      async updateEServiceState(
        state: ApiClientComponentState,
        descriptorId: DescriptorId,
        eserviceId: EServiceId,
        audience: string[],
        voucherLifespan: number,
        logger: Logger,
        correlationId: string
      ) {
        const clientEServiceDetailsUpdate = {
          state,
          descriptorId,
          audience,
          voucherLifespan,
        };

        const token = (await refreshableToken.get()).serialized;
        const headers = getHeaders(correlationId, token);
        await authMgmtClient.updateEServiceState(clientEServiceDetailsUpdate, {
          params: { eserviceId },
          withCredentials: true,
          headers,
        });

        logger.info(`Updating EService ${eserviceId} state for all clients`);
      },
      async updateAgreementState(
        state: ApiClientComponentState,
        agreementId: string,
        eserviceId: EServiceId,
        consumerId: TenantId,
        correlationId: string
      ) {
        const token = (await refreshableToken.get()).serialized;
        const headers = getHeaders(correlationId, token);

        await authMgmtClient.updateAgreementState(
          {
            agreementId,
            state,
          },
          {
            params: {
              eserviceId,
              consumerId,
            },
            withCredentials: true,
            headers,
          }
        );
      },
    };
  };
