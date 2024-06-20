import {
  Client,
  ClientId,
  Descriptor,
  DescriptorId,
  EService,
  EServiceId,
  ListResult,
  Purpose,
  PurposeId,
  PurposeVersionState,
  TenantId,
  UserId,
  WithMetadata,
  authorizationEventToBinaryData,
  clientKind,
  generateId,
  purposeVersionState,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  AuthData,
  DB,
  Logger,
  eventRepository,
  userRoles,
} from "pagopa-interop-commons";
import { SelfcareV2Client } from "pagopa-interop-selfcare-v2-client";
import {
  clientNotFound,
  descriptorNotFound,
  eserviceNotFound,
  keyNotFound,
  noAgreementFoundInRequiredState,
  noPurposeVersionsFoundInRequiredState,
  organizationNotAllowedOnClient,
  purposeAlreadyLinkedToClient,
  purposeNotFound,
  userAlreadyAssigned,
  userIdNotFound,
  userNotAllowedOnClient,
} from "../model/domain/errors.js";
import {
  ApiClientSeed,
  ApiPurposeAdditionSeed,
} from "../model/domain/models.js";
import {
  toCreateEventClientAdded,
  toCreateEventClientDeleted,
  toCreateEventClientKeyDeleted,
  toCreateEventClientPurposeAdded,
  toCreateEventClientPurposeRemoved,
  toCreateEventClientUserAdded,
  toCreateEventClientUserDeleted,
} from "../model/domain/toEvent.js";
import { GetClientsFilters, ReadModelService } from "./readModelService.js";
import {
  assertOrganizationIsPurposeConsumer,
  isClientConsumer,
  assertUserSelfcareSecurityPrivileges,
  assertOrganizationIsClientConsumer,
} from "./validators.js";

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

const retrieveEService = async (
  eserviceId: EServiceId,
  readModelService: ReadModelService
): Promise<EService> => {
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (eservice === undefined) {
    throw eserviceNotFound(eserviceId);
  }
  return eservice;
};

const retrievePurpose = async (
  purposeId: PurposeId,
  readModelService: ReadModelService
): Promise<Purpose> => {
  const purpose = await readModelService.getPurposeById(purposeId);
  if (purpose === undefined) {
    throw purposeNotFound(purposeId);
  }
  return purpose;
};

const retrieveDescriptor = (
  descriptorId: DescriptorId,
  eservice: EService
): Descriptor => {
  const descriptor = eservice.descriptors.find(
    (d: Descriptor) => d.id === descriptorId
  );

  if (descriptor === undefined) {
    throw descriptorNotFound(eservice.id, descriptorId);
  }

  return descriptor;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function authorizationServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService,
  selfcareV2Client: SelfcareV2Client
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
      assertOrganizationIsClientConsumer(organizationId, client.data);
      return {
        client: client.data,
        showUsers: true,
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
        showUsers: true,
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
        showUsers: true,
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
        throw purposeNotFound(purposeIdToRemove);
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
        showUsers: true,
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
      await assertUserSelfcareSecurityPrivileges(
        authData.selfcareId,
        authData.userId,
        authData.organizationId,
        selfcareV2Client
      );
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
        showUsers: true,
      };
    },
    async addClientPurpose({
      clientId,
      seed,
      organizationId,
      correlationId,
      logger,
    }: {
      clientId: ClientId;
      seed: ApiPurposeAdditionSeed;
      organizationId: TenantId;
      correlationId: string;
      logger: Logger;
    }): Promise<void> {
      logger.info(
        `Adding purpose with id ${seed.purposeId} to client ${clientId}`
      );
      const purposeId: PurposeId = unsafeBrandId(seed.purposeId);

      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(organizationId, client.data);

      const purpose = await retrievePurpose(purposeId, readModelService);
      assertOrganizationIsPurposeConsumer(organizationId, purpose);

      if (client.data.purposes.includes(purposeId)) {
        throw purposeAlreadyLinkedToClient(purposeId, client.data.id);
      }

      const eservice = await retrieveEService(
        purpose.eserviceId,
        readModelService
      );

      const agreement = await readModelService.getActiveOrSuspendedAgreement(
        eservice.id,
        organizationId
      );

      if (agreement === undefined) {
        throw noAgreementFoundInRequiredState(eservice.id, organizationId);
      }

      retrieveDescriptor(agreement.descriptorId, eservice);

      const validPurposeVersionStates: Set<PurposeVersionState> = new Set([
        purposeVersionState.active,
        purposeVersionState.suspended,
      ]);
      const purposeVersion = purpose.versions.find((v) =>
        validPurposeVersionStates.has(v.state)
      );

      if (purposeVersion === undefined) {
        throw noPurposeVersionsFoundInRequiredState(purpose.id);
      }

      const updatedClient: Client = {
        ...client.data,
        purposes: [...client.data.purposes, purposeId],
      };

      await repository.createEvent(
        toCreateEventClientPurposeAdded(
          purposeId,
          updatedClient,
          client.metadata.version,
          correlationId
        )
      );
    },
  };
}

export type AuthorizationService = ReturnType<
  typeof authorizationServiceBuilder
>;
