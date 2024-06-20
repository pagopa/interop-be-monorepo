/* eslint-disable max-params */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { RefreshableInteropToken, Logger } from "pagopa-interop-commons";
import {
  DescriptorId,
  EServiceId,
  ClientId,
  PurposeId,
  PurposeVersionId,
  TenantId,
  UserId,
  Client,
  Key,
} from "pagopa-interop-models";
import { AuthorizationManagementClient } from "./authorizationManagementClient.js";
import { ApiClientComponentState } from "./model/models.js";
import { keyUseToApiKeyUse } from "./utils.js";

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
    agreementState: ApiClientComponentState,
    eserviceState: ApiClientComponentState,
    agreementId: string,
    eserviceId: EServiceId,
    descriptorId: DescriptorId,
    consumerId: TenantId,
    audience: string[],
    voucherLifespan: number,
    logger: Logger,
    correlationId: string
  ) => Promise<void>;
  deletePurposeFromClient: (
    clientId: ClientId,
    purposeId: PurposeId,
    logger: Logger,
    correlationId: string
  ) => Promise<void>;
  updatePurposeState: (
    purposeId: PurposeId,
    versionId: PurposeVersionId,
    state: ApiClientComponentState,
    logger: Logger,
    correlationId: string
  ) => Promise<void>;
  addClient: (
    client: Client,
    logger: Logger,
    correlationId: string
  ) => Promise<void>;
  deleteClient: (
    clientId: ClientId,
    logger: Logger,
    correlationId: string
  ) => Promise<void>;
  addClientKey: (
    client: ClientId,
    key: Key,
    logger: Logger,
    correlationId: string
  ) => Promise<void>;
  deleteClientKey: (
    clientId: ClientId,
    kid: string,
    logger: Logger,
    correlationId: string
  ) => Promise<void>;
  addClientUser: (
    clientId: ClientId,
    userId: UserId,
    logger: Logger,
    correlationId: string
  ) => Promise<void>;
  deleteClientUser: (
    clientId: ClientId,
    userId: UserId,
    logger: Logger,
    correlationId: string
  ) => Promise<void>;
  addClientPurpose: (
    clientId: ClientId,
    purposeId: PurposeId,
    logger: Logger,
    correlationId: string
  ) => Promise<void>;
};

export const authorizationServiceBuilder = (
  authMgmtClient: AuthorizationManagementClient,
  refreshableToken: RefreshableInteropToken
): AuthorizationService => {
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
      agreementState: ApiClientComponentState,
      eserviceState: ApiClientComponentState,
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
    async deletePurposeFromClient(
      clientId: ClientId,
      purposeId: PurposeId,
      logger: Logger,
      correlationId: string
    ) {
      const token = (await refreshableToken.get()).serialized;
      const headers = getHeaders(correlationId, token);
      await authMgmtClient.removeClientPurpose(undefined, {
        params: { purposeId, clientId },
        withCredentials: true,
        headers,
      });
      logger.info(`Deleted purpose ${purposeId} from client ${clientId}`);
    },
    async updatePurposeState(
      purposeId: PurposeId,
      versionId: PurposeVersionId,
      state: ApiClientComponentState,
      logger: Logger,
      correlationId: string
    ) {
      const token = (await refreshableToken.get()).serialized;
      const headers = getHeaders(correlationId, token);
      await authMgmtClient.updatePurposeState(
        { versionId, state },
        {
          params: { purposeId },
          withCredentials: true,
          headers,
        }
      );
      logger.info(`Updated Purpose ${purposeId} state for all clients`);
    },
    async addClient(client: Client, logger: Logger, correlationId: string) {
      const token = (await refreshableToken.get()).serialized;
      const headers = getHeaders(correlationId, token);
      await authMgmtClient.createClient(
        {
          name: client.name,
          description: client.description,
          consumerId: client.consumerId,
          createdAt: client.createdAt.toISOString(),
          kind: "CONSUMER", // to do: use client.kind but convert it
          users: client.users,
        },
        {
          withCredentials: true,
          headers,
        }
      );
      logger.info(`Added client ${client.id}`); // to do: remind id will be different in the other readmodel
    },
    async deleteClient(
      clientId: ClientId,
      logger: Logger,
      correlationId: string
    ) {
      const token = (await refreshableToken.get()).serialized;
      const headers = getHeaders(correlationId, token);
      await authMgmtClient.deleteClient(undefined, {
        params: { clientId },
        withCredentials: true,
        headers,
      });
      logger.info(`Delete client ${clientId}`);
    },
    async addClientKey(
      clientId: ClientId,
      key: Key,
      logger: Logger,
      correlationId: string
    ) {
      const token = (await refreshableToken.get()).serialized;
      const headers = getHeaders(correlationId, token);
      await authMgmtClient.createKeys(
        [
          {
            name: key.name,
            createdAt: key.createdAt.toISOString(),
            userId: key.userId,
            key: key.encodedPem, // TO DO: double-check
            use: keyUseToApiKeyUse(key.use),
            alg: key.algorithm,
          },
        ],
        {
          params: { clientId },
          withCredentials: true,
          headers,
        }
      );
      logger.info(`Added key ${key.kid} in client ${clientId}`);
    },
    async deleteClientKey(
      clientId: ClientId,
      kid: string,
      logger: Logger,
      correlationId: string
    ) {
      const token = (await refreshableToken.get()).serialized;
      const headers = getHeaders(correlationId, token);
      await authMgmtClient.deleteClientKeyById(undefined, {
        params: { clientId, keyId: kid },
        withCredentials: true,
        headers,
      });
      logger.info(`Deleted client ${clientId}`);
    },
    async addClientUser(
      clientId: ClientId,
      userId: UserId,
      logger: Logger,
      correlationId: string
    ) {
      const token = (await refreshableToken.get()).serialized;
      const headers = getHeaders(correlationId, token);
      await authMgmtClient.addUser(
        { userId },
        {
          params: { clientId },
          withCredentials: true,
          headers,
        }
      );
      logger.info(`Added user ${userId} in client ${clientId}`);
    },
    async deleteClientUser(
      clientId: ClientId,
      userId: UserId,
      logger: Logger,
      correlationId: string
    ) {
      const token = (await refreshableToken.get()).serialized;
      const headers = getHeaders(correlationId, token);
      await authMgmtClient.removeClientUser(undefined, {
        params: { clientId, userId },
        withCredentials: true,
        headers,
      });
      logger.info(`DRemoved user ${userId} from client ${clientId}`);
    },
    async addClientPurpose(
      clientId: ClientId,
      purposeId: PurposeId,
      logger: Logger,
      correlationId: string
    ) {
      const token = (await refreshableToken.get()).serialized;
      const headers = getHeaders(correlationId, token);
      await authMgmtClient.addClientPurpose(
        {
          // TO DO: how to adjust the input to the following data structure?
          states: {
            eservice: {
              state: "ACTIVE",
              eserviceId: "",
              descriptorId: "",
              audience: [],
              voucherLifespan: 0,
            },
            agreement: {
              agreementId: "",
              state: "ACTIVE",
              eserviceId: "",
              consumerId: "",
            },
            purpose: {
              state: "ACTIVE",
              versionId: "",
              purposeId,
            },
          },
        },
        {
          params: { clientId },
          withCredentials: true,
          headers,
        }
      );
      logger.info(`Linked purpose ${purposeId} to client ${clientId}`);
    },
  };
};
