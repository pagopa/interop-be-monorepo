import {
  Client,
  ClientId,
  Key,
  ListResult,
  PurposeId,
  TenantId,
  UserId,
  WithMetadata,
  authorizationEventToBinaryData,
  clientKind,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  AuthData,
  DB,
  Logger,
  eventRepository,
  userRoles,
} from "pagopa-interop-commons";
import { selfcareV2Client } from "pagopa-interop-selfcare-v2-client";
import {
  clientNotFound,
  keyNotFound,
  organizationNotAllowedOnClient,
  purposeIdNotFound,
  securityUserNotFound,
  tooManyKeysPerClient,
  userAlreadyAssigned,
  userIdNotFound,
  userNotFound,
} from "../model/domain/errors.js";
import {
  ApiClientSeed,
  ApiKeySeed,
  ApiKeysSeed,
} from "../model/domain/models.js";
import {
  toCreateEventClientAdded,
  toCreateEventClientDeleted,
  toCreateEventClientKeyDeleted,
  toCreateEventClientPurposeRemoved,
  toCreateEventClientUserAdded,
  toCreateEventClientUserDeleted,
  toCreateEventKeyAdded,
} from "../model/domain/toEvent.js";
import { ApiKeyUseToKeyUse } from "../model/domain/apiConverter.js";
import { GetClientsFilters, ReadModelService } from "./readModelService.js";
import { isClientConsumer } from "./validators.js";
import { decodeBase64ToPem } from "./../../../commons/src/auth/jwk.js";

const retrieveClient = async (
  clientId: ClientId,
  readModelService: ReadModelService
): Promise<WithMetadata<Client>> => {
  const client = await readModelService.getClientById(clientId);
  if (!client) {
    throw clientNotFound(clientId);
  }
  return client;
};

const retrieveKey = (client: Client, keyId: string): Key => {
  const key = client.keys.find((key) => key.kid === keyId);
  if (!key) {
    throw keyNotFound(keyId, client.id);
  }
  return key;
};

const retrievePurposeId = (client: Client, purposeId: PurposeId): void => {
  if (!client.purposes.find((id) => id === purposeId)) {
    throw purposeIdNotFound(purposeId, client.id);
  }
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function authorizationServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService
) {
  const repository = eventRepository(
    dbInstance,
    authorizationEventToBinaryData
  );

  return {
    async getClientById(
      clientId: ClientId,
      organizationId: TenantId,
      logger: Logger
    ): Promise<{ client: Client; showUsers: boolean }> {
      logger.info(`Retrieving Client ${clientId}`);
      const client = await retrieveClient(clientId, readModelService);
      return {
        client: client.data,
        showUsers: isClientConsumer(client.data.consumerId, organizationId),
      };
    },

    async createConsumerClient(
      clientSeed: ApiClientSeed,
      organizationId: TenantId,
      correlationId: string,
      logger: Logger
    ): Promise<{ client: Client; showUsers: boolean }> {
      logger.info(
        `Creating CONSUMER client ${clientSeed.name} for consumer ${organizationId}"`
      );
      const client: Client = {
        id: generateId(),
        consumerId: organizationId,
        name: clientSeed.name,
        purposes: [],
        description: clientSeed.description,
        relationships: [],
        kind: clientKind.consumer,
        users: clientSeed.members.map(unsafeBrandId<UserId>),
        createdAt: new Date(),
        keys: [],
      };

      await repository.createEvent(
        toCreateEventClientAdded(client, correlationId)
      );

      return {
        client,
        showUsers: client.consumerId === organizationId,
      };
    },
    async createApiClient(
      clientSeed: ApiClientSeed,
      organizationId: TenantId,
      correlationId: string,
      logger: Logger
    ): Promise<{ client: Client; showUsers: boolean }> {
      logger.info(
        `Creating API client ${clientSeed.name} for consumer ${organizationId}"`
      );
      const client: Client = {
        id: generateId(),
        consumerId: organizationId,
        name: clientSeed.name,
        purposes: [],
        description: clientSeed.description,
        relationships: [],
        kind: clientKind.api,
        users: clientSeed.members.map(unsafeBrandId<UserId>),
        createdAt: new Date(),
        keys: [],
      };

      await repository.createEvent(
        toCreateEventClientAdded(client, correlationId)
      );

      return {
        client,
        showUsers: client.consumerId === organizationId,
      };
    },
    async getClients(
      filters: GetClientsFilters,
      { offset, limit }: { offset: number; limit: number },
      authData: AuthData,
      logger: Logger
    ): Promise<ListResult<Client>> {
      logger.info(
        `Retrieving clients by name ${filters.name} , userIds ${filters.userIds}`
      );
      const userIds = authData.userRoles.includes("security")
        ? [authData.userId]
        : filters.userIds.map(unsafeBrandId<UserId>);

      return await readModelService.getClients(
        { ...filters, userIds },
        {
          offset,
          limit,
        }
      );
    },
    async deleteClient({
      clientId,
      organizationId,
      correlationId,
      logger,
    }: {
      clientId: ClientId;
      organizationId: TenantId;
      correlationId: string;
      logger: Logger;
    }): Promise<void> {
      logger.info(`Deleting client ${clientId}`);

      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(organizationId, client.data);

      await repository.createEvent(
        toCreateEventClientDeleted(
          client.data,
          client.metadata.version,
          correlationId
        )
      );
    },
    async removeUser({
      clientId,
      userIdToRemove,
      organizationId,
      correlationId,
      logger,
    }: {
      clientId: ClientId;
      userIdToRemove: UserId;
      organizationId: TenantId;
      correlationId: string;
      logger: Logger;
    }): Promise<void> {
      logger.info(`Removing user ${userIdToRemove} from client ${clientId}`);

      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(organizationId, client.data);

      if (!client.data.users.includes(userIdToRemove)) {
        throw userIdNotFound(userIdToRemove, clientId);
      }

      const updatedClient: Client = {
        ...client.data,
        users: client.data.users.filter((userId) => userId !== userIdToRemove),
      };

      await repository.createEvent(
        toCreateEventClientUserDeleted(
          updatedClient,
          userIdToRemove,
          client.metadata.version,
          correlationId
        )
      );
    },
    async deleteClientKeyById({
      clientId,
      keyIdToRemove,
      organizationId,
      correlationId,
      logger,
    }: {
      clientId: ClientId;
      keyIdToRemove: string;
      organizationId: TenantId;
      correlationId: string;
      logger: Logger;
    }): Promise<void> {
      logger.info(`Removing key ${keyIdToRemove} from client ${clientId}`);

      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(organizationId, client.data);

      retrieveKey(client.data, keyIdToRemove);

      const updatedClient: Client = {
        ...client.data,
        keys: client.data.keys.filter((key) => key.kid !== keyIdToRemove),
      };

      await repository.createEvent(
        toCreateEventClientKeyDeleted(
          updatedClient,
          keyIdToRemove,
          client.metadata.version,
          correlationId
        )
      );
    },
    async removeClientPurpose({
      clientId,
      purposeIdToRemove,
      organizationId,
      correlationId,
      logger,
    }: {
      clientId: ClientId;
      purposeIdToRemove: PurposeId;
      organizationId: TenantId;
      correlationId: string;
      logger: Logger;
    }): Promise<void> {
      logger.info(
        `Removing purpose ${purposeIdToRemove} from client ${clientId}`
      );

      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(organizationId, client.data);

      retrievePurposeId(client.data, purposeIdToRemove);

      const updatedClient: Client = {
        ...client.data,
        purposes: client.data.purposes.filter(
          (purposeId) => purposeId !== purposeIdToRemove
        ),
      };

      await repository.createEvent(
        toCreateEventClientPurposeRemoved(
          updatedClient,
          purposeIdToRemove,
          client.metadata.version,
          correlationId
        )
      );
    },
    async removePurposeFromClients(
      purposeIdToRemove: PurposeId,
      correlationId: string,
      logger: Logger
    ): Promise<void> {
      logger.info(`Removing purpose ${purposeIdToRemove} from all clients`);

      const clients = await readModelService.getClientsRelatedToPurpose(
        purposeIdToRemove
      );
      for (const client of clients) {
        const updatedClient: Client = {
          ...client.data,
          purposes: client.data.purposes.filter(
            (purposeId) => purposeId !== purposeIdToRemove
          ),
        };

        await repository.createEvent(
          toCreateEventClientPurposeRemoved(
            updatedClient,
            purposeIdToRemove,
            client.metadata.version,
            correlationId
          )
        );
      }
    },
    async getClientUsers(
      clientId: ClientId,
      organizationId: TenantId,
      logger: Logger
    ): Promise<{ users: UserId[]; showUsers: boolean }> {
      logger.info(`Retrieving users of client ${clientId}`);
      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(organizationId, client.data);
      return {
        users: client.data.users,
        showUsers: isClientConsumer(client.data.consumerId, organizationId),
      };
    },
    async addUser(
      {
        clientId,
        userId,
        authData,
      }: {
        clientId: ClientId;
        userId: UserId;
        authData: AuthData;
      },
      correlationId: string,
      logger: Logger
    ): Promise<{ client: Client; showUsers: boolean }> {
      logger.info(`Binding client ${clientId} with user ${userId}`);
      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(authData.organizationId, client.data);
      await assertSecurityUser(authData.selfcareId, authData.userId, userId);
      if (client.data.users.includes(userId)) {
        throw userAlreadyAssigned(clientId, userId);
      }
      const updatedClient: Client = {
        ...client.data,
        users: [...client.data.users, userId],
      };

      await repository.createEvent(
        toCreateEventClientUserAdded(
          userId,
          updatedClient,
          client.metadata.version,
          correlationId
        )
      );
      return {
        client: updatedClient,
        showUsers: updatedClient.consumerId === authData.organizationId,
      };
    },

    async getClientKeys(
      clientId: ClientId,
      organizationId: TenantId,
      logger: Logger
    ): Promise<Key[]> {
      logger.info(`Retrieving keys for client ${clientId}`);
      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(organizationId, client.data);
      return client.data.keys;
    },

    async createKeys(
      clientId: ClientId,
      authData: AuthData,
      keysSeeds: ApiKeysSeed,
      correlationId: string,
      logger: Logger
    ): Promise<{ client: Client; showUsers: boolean }> {
      logger.info(`Creating keys for client ${clientId}`);
      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(
        unsafeBrandId(authData.organizationId),
        client.data
      );
      const keys = await this.getClientKeys(
        clientId,
        unsafeBrandId(authData.organizationId),
        logger
      );
      assertKeyIsBelowThreshold(clientId, keys.length + keysSeeds.length);
      if (!client.data.users.includes(authData.userId)) {
        throw userNotFound(authData.userId, authData.selfcareId);
      }
      await assertSecurityUser(
        authData.selfcareId,
        authData.userId,
        authData.userId
      );

      const newKeys = await Promise.all(
        keysSeeds.map(async (k) => {
          const key: Key = {
            name: k.name,
            createdAt: new Date(),
            kid: "",
            encodedPem: validateKey(k),
            algorithm: k.alg,
            use: ApiKeyUseToKeyUse(k.use),
            userId: authData.userId,
          };
          const clientForTheEvent = {
            ...client.data,
            keys: [...client.data.keys, key],
          };
          await repository.createEvent(
            toCreateEventKeyAdded(
              "kid",
              clientForTheEvent,
              client.metadata.version,
              correlationId
            )
          );
          return key;
        })
      );

      const newClient: Client = {
        ...client.data,
        keys: [...client.data.keys, ...newKeys],
      };

      return {
        client: newClient,
        showUsers: newClient.consumerId === authData.organizationId,
      };
    },
  };
}

export type AuthorizationService = ReturnType<
  typeof authorizationServiceBuilder
>;

const assertOrganizationIsClientConsumer = (
  organizationId: TenantId,
  client: Client
): void => {
  if (client.consumerId !== organizationId) {
    throw organizationNotAllowedOnClient(organizationId, client.id);
  }
};
const assertSecurityUser = async (
  selfcareId: string,
  requesterUserId: UserId,
  userId: UserId
): Promise<void> => {
  const users = await selfcareV2Client.getInstitutionProductUsersUsingGET({
    params: { institutionId: selfcareId },
    queries: {
      userIdForAuth: requesterUserId,
      userId,
      productRoles: [userRoles.SECURITY_ROLE, userRoles.ADMIN_ROLE],
    },
  });
  if (users.length === 0) {
    throw securityUserNotFound(requesterUserId, userId);
  }
};

const assertKeyIsBelowThreshold = (clientId: ClientId, size: number): void => {
  if (size > 100) {
    throw tooManyKeysPerClient(clientId, size);
  }
};

const validateKey = (keySeed: ApiKeySeed): string =>
  decodeBase64ToPem(keySeed.key);
