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
  ClientKey,
  genericInternalError,
} from "pagopa-interop-models";
import { authorizationManagementApi } from "pagopa-interop-api-clients";
import {
  agreementStateToClientState,
  clientKindToApiClientKind,
  descriptorStateToClientState,
  keyUseToApiKeyUse,
  purposeStateToClientState,
} from "./utils.js";
import { ReadModelService } from "./readModelService.js";
import { AuthorizationManagementClients } from "./authorizationManagementClient.js";

export type AuthorizationService = {
  updateEServiceState: (
    state: authorizationManagementApi.ClientComponentState,
    descriptorId: DescriptorId,
    eserviceId: EServiceId,
    audience: string[],
    voucherLifespan: number,
    logger: Logger,
    correlationId: string
  ) => Promise<void>;
  updateAgreementState: (
    state: authorizationManagementApi.ClientComponentState,
    agreementId: string,
    eserviceId: EServiceId,
    consumerId: TenantId,
    logger: Logger,
    correlationId: string
  ) => Promise<void>;
  updateAgreementAndEServiceStates: (
    agreementState: authorizationManagementApi.ClientComponentState,
    eserviceState: authorizationManagementApi.ClientComponentState,
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
    state: authorizationManagementApi.ClientComponentState,
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
    key: ClientKey,
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
    readModelService: ReadModelService,
    logger: Logger,
    correlationId: string
  ) => Promise<void>;
};

export const authorizationServiceBuilder = (
  authMgmtClients: AuthorizationManagementClients,
  refreshableToken: RefreshableInteropToken
): AuthorizationService => {
  const getHeaders = (correlationId: string, token: string) => ({
    "X-Correlation-Id": correlationId,
    Authorization: `Bearer ${token}`,
  });

  return {
    // eslint-disable-next-line max-params
    async updateEServiceState(
      state: authorizationManagementApi.ClientComponentState,
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
      await authMgmtClients.purposeApiClient.updateEServiceState(
        clientEServiceDetailsUpdate,
        {
          params: { eserviceId },
          withCredentials: true,
          headers,
        }
      );

      logger.info(`Updating EService ${eserviceId} state for all clients`);
    },
    async updateAgreementState(
      state: authorizationManagementApi.ClientComponentState,
      agreementId: string,
      eserviceId: EServiceId,
      consumerId: TenantId,
      logger: Logger,
      correlationId: string
    ) {
      const token = (await refreshableToken.get()).serialized;
      const headers = getHeaders(correlationId, token);

      await authMgmtClients.purposeApiClient.updateAgreementState(
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
      agreementState: authorizationManagementApi.ClientComponentState,
      eserviceState: authorizationManagementApi.ClientComponentState,
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

      await authMgmtClients.purposeApiClient.updateAgreementAndEServiceStates(
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
      await authMgmtClients.purposeApiClient.removeClientPurpose(undefined, {
        params: { purposeId, clientId },
        withCredentials: true,
        headers,
      });
      logger.info(`Deleted purpose ${purposeId} from client ${clientId}`);
    },
    async updatePurposeState(
      purposeId: PurposeId,
      versionId: PurposeVersionId,
      state: authorizationManagementApi.ClientComponentState,
      logger: Logger,
      correlationId: string
    ) {
      const token = (await refreshableToken.get()).serialized;
      const headers = getHeaders(correlationId, token);
      await authMgmtClients.purposeApiClient.updatePurposeState(
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
      await authMgmtClients.clientApiClient.createClient(
        {
          clientId: client.id,
          name: client.name,
          description: client.description,
          consumerId: client.consumerId,
          createdAt: client.createdAt.toISOString(),
          kind: clientKindToApiClientKind(client.kind),
          users: client.users,
        },
        {
          withCredentials: true,
          headers,
        }
      );
      logger.info(`Added client ${client.id}`);
    },
    async deleteClient(
      clientId: ClientId,
      logger: Logger,
      correlationId: string
    ) {
      const token = (await refreshableToken.get()).serialized;
      const headers = getHeaders(correlationId, token);
      await authMgmtClients.clientApiClient.deleteClient(undefined, {
        params: { clientId },
        withCredentials: true,
        headers,
      });
      logger.info(`Deleted client ${clientId}`);
    },
    async addClientKey(
      clientId: ClientId,
      key: ClientKey,
      logger: Logger,
      correlationId: string
    ) {
      const token = (await refreshableToken.get()).serialized;
      const headers = getHeaders(correlationId, token);
      await authMgmtClients.keyApiClient.createKeys(
        [
          {
            name: key.name,
            createdAt: key.createdAt.toISOString(),
            userId: key.userId,
            key: key.encodedPem,
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
      await authMgmtClients.keyApiClient.deleteClientKeyById(undefined, {
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
      await authMgmtClients.clientApiClient.addUser(
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
      await authMgmtClients.clientApiClient.removeClientUser(undefined, {
        params: { clientId, userId },
        withCredentials: true,
        headers,
      });
      logger.info(`Removed user ${userId} from client ${clientId}`);
    },
    async addClientPurpose(
      clientId: ClientId,
      purposeId: PurposeId,
      readModelService: ReadModelService,
      logger: Logger,
      correlationId: string
    ) {
      const token = (await refreshableToken.get()).serialized;
      const headers = getHeaders(correlationId, token);

      const purpose = await readModelService.getPurposeById(purposeId);
      if (!purpose) {
        throw genericInternalError("purpose not found");
      }

      const eservice = await readModelService.getEServiceById(
        purpose.eserviceId
      );
      if (!eservice) {
        throw genericInternalError("eservice not found");
      }

      const agreement = await readModelService.getAgreement(
        eservice.id,
        purpose.consumerId
      );
      if (!agreement) {
        throw genericInternalError("agreement not found");
      }

      const descriptor = eservice.descriptors.find(
        (d) => d.id === agreement.descriptorId
      );
      if (!descriptor) {
        throw genericInternalError("descriptor not found");
      }

      const purposeVersion = purpose.versions[purpose.versions.length - 1];

      await authMgmtClients.purposeApiClient.addClientPurpose(
        {
          states: {
            eservice: {
              state: descriptorStateToClientState(descriptor.state),
              eserviceId: eservice.id,
              descriptorId: agreement.descriptorId,
              audience: descriptor.audience,
              voucherLifespan: descriptor.voucherLifespan,
            },
            agreement: {
              agreementId: agreement.id,
              state: agreementStateToClientState(agreement.state),
              eserviceId: agreement.eserviceId,
              consumerId: agreement.consumerId,
            },
            purpose: {
              state: purposeStateToClientState(purposeVersion.state),
              versionId: purposeVersion.id,
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
