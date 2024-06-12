import {
  Client,
  ClientId,
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
import {
  clientNotFound,
  keyNotFound,
  organizationNotAllowedOnClient,
  purposeIdNotFound,
  userIdNotFound,
  userNotAllowedOnClient,
} from "../model/domain/errors.js";
import { ApiClientSeed } from "../model/domain/models.js";
import {
  toCreateEventClientAdded,
  toCreateEventClientDeleted,
  toCreateEventClientKeyDeleted,
  toCreateEventClientPurposeRemoved,
  toCreateEventClientUserDeleted,
} from "../model/domain/toEvent.js";
import { GetClientsFilters, ReadModelService } from "./readModelService.js";
import { isClientConsumer } from "./validators.js";

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
      const userIds = authData.userRoles.includes(userRoles.SECURITY_ROLE)
        ? [authData.userId]
        : filters.userIds;

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
      authData,
      correlationId,
      logger,
    }: {
      clientId: ClientId;
      keyIdToRemove: string;
      authData: AuthData;
      correlationId: string;
      logger: Logger;
    }): Promise<void> {
      logger.info(`Removing key ${keyIdToRemove} from client ${clientId}`);

      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(authData.organizationId, client.data);

      const keyToRemove = client.data.keys.find(
        (key) => key.kid === keyIdToRemove
      );
      if (!keyToRemove) {
        throw keyNotFound(keyIdToRemove, client.data.id);
      }
      if (
        authData.userRoles.includes(userRoles.SECURITY_ROLE) &&
        !client.data.users.includes(authData.userId)
      ) {
        throw userNotAllowedOnClient(authData.userId, client.data.id);
      }

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

      if (!client.data.purposes.find((id) => id === purposeIdToRemove)) {
        throw purposeIdNotFound(purposeIdToRemove, client.data.id);
      }

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
    async removePurposeFromClients({
      purposeIdToRemove,
      correlationId,
      logger,
    }: {
      purposeIdToRemove: PurposeId;
      correlationId: string;
      logger: Logger;
    }): Promise<void> {
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
