/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { JsonWebKey } from "crypto";
import {
  Client,
  ClientId,
  Descriptor,
  DescriptorId,
  EService,
  EServiceId,
  Key,
  KeyWithClient,
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
  genericInternalError,
  purposeVersionState,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  AuthData,
  DB,
  Logger,
  eventRepository,
  userRoles,
  calculateKid,
  decodeBase64ToPem,
  createJWK,
} from "pagopa-interop-commons";
import { SelfcareV2Client } from "pagopa-interop-selfcare-v2-client";
import {
  clientNotFound,
  descriptorNotFound,
  eserviceNotFound,
  keyAlreadyExists,
  keyNotFound,
  noAgreementFoundInRequiredState,
  noPurposeVersionsFoundInRequiredState,
  purposeAlreadyLinkedToClient,
  purposeNotFound,
  tooManyKeysPerClient,
  userAlreadyAssigned,
  userIdNotFound,
  userNotFound,
  userNotAllowedOnClient,
  unknownKeyType,
} from "../model/domain/errors.js";
import {
  ApiClientSeed,
  ApiKeysSeed,
  ApiPurposeAdditionSeed,
  ApiJWKKey,
} from "../model/domain/models.js";
import {
  toCreateEventClientAdded,
  toCreateEventClientDeleted,
  toCreateEventClientKeyDeleted,
  toCreateEventClientPurposeAdded,
  toCreateEventClientPurposeRemoved,
  toCreateEventClientUserAdded,
  toCreateEventClientUserDeleted,
  toCreateEventKeyAdded,
} from "../model/domain/toEvent.js";
import { config } from "../utilities/config.js";
import { ApiKeyUseToKeyUse } from "../model/domain/apiConverter.js";
import { GetClientsFilters, ReadModelService } from "./readModelService.js";
import {
  assertOrganizationIsPurposeConsumer,
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
    async getClientById({
      clientId,
      organizationId,
      logger,
    }: {
      clientId: ClientId;
      organizationId: TenantId;
      logger: Logger;
    }): Promise<{ client: Client; showUsers: boolean }> {
      logger.info(`Retrieving Client ${clientId}`);
      const client = await retrieveClient(clientId, readModelService);
      return {
        client: client.data,
        showUsers: organizationId === client.data.consumerId,
      };
    },

    async createConsumerClient({
      clientSeed,
      organizationId,
      correlationId,
      logger,
    }: {
      clientSeed: ApiClientSeed;
      organizationId: TenantId;
      correlationId: string;
      logger: Logger;
    }): Promise<{ client: Client; showUsers: boolean }> {
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
    async createApiClient({
      clientSeed,
      organizationId,
      correlationId,
      logger,
    }: {
      clientSeed: ApiClientSeed;
      organizationId: TenantId;
      correlationId: string;
      logger: Logger;
    }): Promise<{ client: Client; showUsers: boolean }> {
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
    async getClients({
      filters,
      authData,
      offset,
      limit,
      logger,
    }: {
      filters: GetClientsFilters;
      authData: AuthData;
      offset: number;
      limit: number;
      logger: Logger;
    }): Promise<ListResult<Client>> {
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

      // if (!client.data.purposes.find((id) => id === purposeIdToRemove)) {
      //   throw purposeNotFound(purposeIdToRemove);
      // }

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
    async getClientUsers({
      clientId,
      organizationId,
      logger,
    }: {
      clientId: ClientId;
      organizationId: TenantId;
      logger: Logger;
    }): Promise<{ users: UserId[]; showUsers: boolean }> {
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
      await assertUserSelfcareSecurityPrivileges({
        selfcareId: authData.selfcareId,
        requesterUserId: authData.userId,
        consumerId: authData.organizationId,
        selfcareV2Client,
        userIdToCheck: userId,
      });
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
    async getClientKeys({
      clientId,
      userIds,
      organizationId,
      logger,
    }: {
      clientId: ClientId;
      userIds: UserId[];
      organizationId: TenantId;
      logger: Logger;
    }): Promise<Key[]> {
      logger.info(`Retrieving keys for client ${clientId}`);
      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(organizationId, client.data);
      if (userIds.length > 0) {
        return client.data.keys.filter(
          (k) => k.userId && userIds.includes(k.userId)
        );
      } else {
        return client.data.keys;
      }
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

    async createKeys({
      clientId,
      authData,
      keysSeeds,
      correlationId,
      logger,
    }: {
      clientId: ClientId;
      authData: AuthData;
      keysSeeds: ApiKeysSeed;
      correlationId: string;
      logger: Logger;
    }): Promise<{ client: Client; showUsers: boolean }> {
      logger.info(`Creating keys for client ${clientId}`);
      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(
        unsafeBrandId(authData.organizationId),
        client.data
      );
      assertKeysCountIsBelowThreshold(
        clientId,
        client.data.keys.length + keysSeeds.length
      );
      if (!client.data.users.includes(authData.userId)) {
        throw userNotFound(authData.userId, authData.selfcareId);
      }

      await assertUserSelfcareSecurityPrivileges({
        selfcareId: authData.selfcareId,
        requesterUserId: authData.userId,
        consumerId: authData.organizationId,
        selfcareV2Client,
        userIdToCheck: authData.userId,
      });

      if (keysSeeds.length !== 1) {
        throw genericInternalError("Wrong number of keys"); // TODO should we add a specific error?
      }
      const keySeed = keysSeeds[0];
      const jwk = createJWK(decodeBase64ToPem(keySeed.key));
      const newKey: Key = {
        clientId,
        name: keySeed.name,
        createdAt: new Date(),
        kid: calculateKid(jwk),
        encodedPem: keySeed.key,
        algorithm: keySeed.alg,
        use: ApiKeyUseToKeyUse(keySeed.use),
        userId: authData.userId,
      };
      const duplicateKid = await readModelService.getKeyByKid(newKey.kid);
      if (duplicateKid) {
        throw keyAlreadyExists(newKey.kid);
      }
      const updatedClient: Client = {
        ...client.data,
        keys: [...client.data.keys, newKey],
      };
      await repository.createEvent(
        toCreateEventKeyAdded(
          newKey.kid,
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
    async getClientKeyById({
      clientId,
      kid,
      organizationId,
      logger,
    }: {
      clientId: ClientId;
      kid: string;
      organizationId: TenantId;
      logger: Logger;
    }): Promise<Key> {
      logger.info(`Retrieving key ${kid} in client ${clientId}`);
      const client = await retrieveClient(clientId, readModelService);

      assertOrganizationIsClientConsumer(organizationId, client.data);
      const key = client.data.keys.find((key) => key.kid === kid);

      if (!key) {
        throw keyNotFound(kid, clientId);
      }
      return key;
    },
    async getKeyWithClientByKeyId({
      clientId,
      kid,
      logger,
    }: {
      clientId: ClientId;
      kid: string;
      logger: Logger;
    }): Promise<KeyWithClient> {
      logger.info(`Getting client ${clientId} and key ${kid}`);
      const client = await retrieveClient(clientId, readModelService);
      const key = client.data.keys.find((key) => key.kid === kid);

      if (!key) {
        throw keyNotFound(kid, clientId);
      }

      const jwk: JsonWebKey = createJWK(decodeBase64ToPem(key.encodedPem));
      if (jwk.kty!.toUpperCase() !== "RSA") {
        throw unknownKeyType(jwk.kty!);
      }
      const jwkKey: ApiJWKKey = {
        kty: jwk.kty!,
        keyOps: [],
        use: key.use,
        alg: key.algorithm,
        kid: key.kid,
        x5u: "",
        x5t: "",
        x5tS256: [],
        x5c: [],
        crv: jwk.crv,
        x: jwk.x,
        y: jwk.y,
        d: jwk.d,
        k: jwk.k,
        n: jwk.n,
        e: jwk.e,
        p: jwk.p,
        q: jwk.q,
        dp: jwk.dp,
        dq: jwk.dq,
        qi: jwk.qi,
        oth: [],
      };

      return {
        JWKKey: jwkKey,
        client: client.data,
      };
    },
  };
}

export type AuthorizationService = ReturnType<
  typeof authorizationServiceBuilder
>;

const assertKeysCountIsBelowThreshold = (
  clientId: ClientId,
  size: number
): void => {
  if (size > config.maxKeysPerClient) {
    throw tooManyKeysPerClient(clientId, size);
  }
};
