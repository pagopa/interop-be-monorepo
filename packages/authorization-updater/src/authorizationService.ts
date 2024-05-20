/* eslint-disable max-params */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { RefreshableInteropToken, Logger } from "pagopa-interop-commons";
import { DescriptorId, EServiceId, TenantId } from "pagopa-interop-models";
import { AuthorizationManagementClient } from "./authorizationManagementClient.js";
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
    logger: Logger,
    correlationId: string
  ) => Promise<void>;

  updateAgreementAndEServiceStates: (
    eserviceState: ApiClientComponentState,
    agreementState: ApiClientComponentState,
    agreementId: string,
    eserviceId: EServiceId,
    descriptorId: DescriptorId,
    consumerId: TenantId,
    audience: string[],
    voucherLifespan: number,
    logger: Logger,
    correlationId: string
  ) => Promise<void>;
};

export const authorizationServiceBuilder = async (
  authMgmtClient: AuthorizationManagementClient,
  refreshableToken: RefreshableInteropToken
): Promise<AuthorizationService> => {
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
      logger: Logger,
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

      logger.info(`Updated Agreement ${agreementId} state for all clients`);
    },
    async updateAgreementAndEServiceStates(
      eserviceState: ApiClientComponentState,
      agreementState: ApiClientComponentState,
      agreementId: string,
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      consumerId: TenantId,
      audience: string[],
      voucherLifespan: number,
      logger: Logger,
      correlationId: string
    ) {
      const token = (await refreshableToken.get()).serialized;
      const headers = getHeaders(correlationId, token);

      await authMgmtClient.updateAgreementAndEServiceStates(
        {
          agreementId,
          agreementState,
          descriptorId,
          eserviceState,
          audience,
          voucherLifespan,
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

      logger.info(
        `Updated Agreement ${agreementId} and EService ${eserviceId} states for all clients`
      );
    },
  };
};
