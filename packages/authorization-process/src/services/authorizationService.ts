import { JsonWebKey } from "crypto";
import {
  authorizationEventToBinaryData,
  Client,
  ClientId,
  clientKind,
  Delegation,
  Descriptor,
  DescriptorId,
  EService,
  EServiceId,
  generateId,
  Key,
  ListResult,
  ProducerKeychain,
  ProducerKeychainId,
  Purpose,
  PurposeId,
  PurposeVersionState,
  purposeVersionState,
  unsafeBrandId,
  UserId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  AppContext,
  calculateKid,
  createJWK,
  DB,
  eventRepository,
  hasAtLeastOneUserRole,
  InternalAuthData,
  isUiAuthData,
  M2MAuthData,
  UIAuthData,
  userRole,
  WithLogger,
} from "pagopa-interop-commons";
import {
  authorizationApi,
  SelfcareV2InstitutionClient,
} from "pagopa-interop-api-clients";

import {
  clientKeyNotFound,
  clientNotFound,
  clientUserAlreadyAssigned,
  clientUserIdNotFound,
  descriptorNotFound,
  eserviceAlreadyLinkedToProducerKeychain,
  eserviceNotDelegableForClientAccess,
  eserviceNotFound,
  noAgreementFoundInRequiredState,
  noPurposeVersionsFoundInRequiredState,
  producerKeychainNotFound,
  producerKeychainUserAlreadyAssigned,
  producerKeychainUserIdNotFound,
  producerKeyNotFound,
  purposeAlreadyLinkedToClient,
  purposeDelegationNotFound,
  purposeNotFound,
  userNotAllowedOnClient,
  userNotAllowedOnProducerKeychain,
  userNotAllowedToDeleteClientKey,
  userNotAllowedToDeleteProducerKeychainKey,
  userNotFound,
} from "../model/domain/errors.js";
import {
  toCreateEventClientAdded,
  toCreateEventClientDeleted,
  toCreateEventClientKeyDeleted,
  toCreateEventClientPurposeAdded,
  toCreateEventClientPurposeRemoved,
  toCreateEventClientUserAdded,
  toCreateEventClientUserDeleted,
  toCreateEventKeyAdded,
  toCreateEventProducerKeychainAdded,
  toCreateEventProducerKeychainDeleted,
  toCreateEventProducerKeychainEServiceAdded,
  toCreateEventProducerKeychainEServiceRemoved,
  toCreateEventProducerKeychainKeyAdded,
  toCreateEventProducerKeychainKeyDeleted,
  toCreateEventProducerKeychainUserAdded,
  toCreateEventProducerKeychainUserDeleted,
} from "../model/domain/toEvent.js";
import {
  ApiKeyUseToKeyUse,
  clientToApiClient,
} from "../model/domain/apiConverter.js";
import {
  GetClientsFilters,
  GetProducerKeychainsFilters,
  ReadModelService,
} from "./readModelService.js";
import {
  assertClientKeysCountIsBelowThreshold,
  assertKeyDoesNotAlreadyExist,
  assertOrganizationIsClientConsumer,
  assertOrganizationIsEServiceProducer,
  assertOrganizationIsProducerKeychainProducer,
  assertOrganizationIsPurposeConsumer,
  assertProducerKeychainKeysCountIsBelowThreshold,
  assertRequesterIsDelegateConsumer,
  assertUserSelfcareSecurityPrivileges,
  assertSecurityRoleIsClientMember,
  assertClientIsConsumer,
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

const retrievePurposeDelegation = async (
  purpose: Purpose,
  readModelService: ReadModelService
): Promise<Delegation | undefined> => {
  if (!purpose.delegationId) {
    return undefined;
  }

  const delegation = await readModelService.getActiveConsumerDelegationById(
    purpose.delegationId
  );
  if (!delegation) {
    throw purposeDelegationNotFound(purpose.delegationId);
  }

  return delegation;
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

const retrieveProducerKeychain = async (
  producerKeychainId: ProducerKeychainId,
  readModelService: ReadModelService
): Promise<WithMetadata<ProducerKeychain>> => {
  const producerKeychain = await readModelService.getProducerKeychainById(
    producerKeychainId
  );
  if (!producerKeychain) {
    throw producerKeychainNotFound(producerKeychainId);
  }
  return producerKeychain;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function authorizationServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService,
  selfcareV2InstitutionClient: SelfcareV2InstitutionClient
) {
  const repository = eventRepository(
    dbInstance,
    authorizationEventToBinaryData
  );

  return {
    async getClientById(
      {
        clientId,
      }: {
        clientId: ClientId;
      },
      { logger, authData }: WithLogger<AppContext<UIAuthData | M2MAuthData>>
    ): Promise<{ client: Client; showUsers: boolean }> {
      logger.info(`Retrieving Client ${clientId}`);
      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(authData, client.data);
      return {
        client: client.data,
        showUsers: authData.organizationId === client.data.consumerId,
      };
    },

    async createConsumerClient(
      {
        clientSeed,
      }: {
        clientSeed: authorizationApi.ClientSeed;
      },
      { logger, correlationId, authData }: WithLogger<AppContext<UIAuthData>>
    ): Promise<{ client: Client; showUsers: boolean }> {
      logger.info(
        `Creating CONSUMER client ${clientSeed.name} for consumer ${authData.organizationId}"`
      );
      const client: Client = {
        id: generateId(),
        consumerId: authData.organizationId,
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
      {
        clientSeed,
      }: {
        clientSeed: authorizationApi.ClientSeed;
      },
      { logger, correlationId, authData }: WithLogger<AppContext<UIAuthData>>
    ): Promise<{ client: Client; showUsers: boolean }> {
      logger.info(
        `Creating API client ${clientSeed.name} for consumer ${authData.organizationId}"`
      );
      const client: Client = {
        id: generateId(),
        consumerId: authData.organizationId,
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
      {
        filters,
        offset,
        limit,
      }: {
        filters: GetClientsFilters;
        offset: number;
        limit: number;
      },
      { authData, logger }: WithLogger<AppContext<UIAuthData | M2MAuthData>>
    ): Promise<ListResult<Client>> {
      logger.info(
        `Retrieving clients by name ${filters.name} , userIds ${filters.userIds}`
      );

      const userIds =
        isUiAuthData(authData) &&
        hasAtLeastOneUserRole(authData, [userRole.SECURITY_ROLE])
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
    async deleteClient(
      {
        clientId,
      }: {
        clientId: ClientId;
      },
      { logger, correlationId, authData }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> {
      logger.info(`Deleting client ${clientId}`);

      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(authData, client.data);

      await repository.createEvent(
        toCreateEventClientDeleted(
          client.data,
          client.metadata.version,
          correlationId
        )
      );
    },
    async removeClientUser(
      {
        clientId,
        userIdToRemove,
      }: {
        clientId: ClientId;
        userIdToRemove: UserId;
      },
      { logger, correlationId, authData }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> {
      logger.info(`Removing user ${userIdToRemove} from client ${clientId}`);

      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(authData, client.data);

      if (!client.data.users.includes(userIdToRemove)) {
        throw clientUserIdNotFound(userIdToRemove, clientId);
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
    async deleteClientKeyById(
      {
        clientId,
        keyIdToRemove,
      }: {
        clientId: ClientId;
        keyIdToRemove: string;
      },
      { logger, correlationId, authData }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> {
      logger.info(`Removing key ${keyIdToRemove} from client ${clientId}`);

      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(authData, client.data);

      const hasSecurityRole = hasAtLeastOneUserRole(authData, [
        userRole.SECURITY_ROLE,
      ]);

      if (hasSecurityRole && !client.data.users.includes(authData.userId)) {
        throw userNotAllowedOnClient(authData.userId, client.data.id);
      }

      const keyToRemove = client.data.keys.find(
        (key) => key.kid === keyIdToRemove
      );

      if (!keyToRemove) {
        throw clientKeyNotFound(keyIdToRemove, client.data.id);
      }

      if (hasSecurityRole && keyToRemove.userId !== authData.userId) {
        throw userNotAllowedToDeleteClientKey(
          authData.userId,
          client.data.id,
          keyToRemove.kid
        );
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
    async removeClientPurpose(
      {
        clientId,
        purposeIdToRemove,
      }: {
        clientId: ClientId;
        purposeIdToRemove: PurposeId;
      },
      { correlationId, authData, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> {
      logger.info(
        `Removing purpose ${purposeIdToRemove} from client ${clientId}`
      );

      const client = await retrieveClient(clientId, readModelService);

      assertClientIsConsumer(client.data);

      assertOrganizationIsClientConsumer(authData, client.data);

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
    async removePurposeFromClients(
      {
        purposeIdToRemove,
      }: {
        purposeIdToRemove: PurposeId;
      },
      {
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | InternalAuthData>>
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
      {
        clientId,
      }: {
        clientId: ClientId;
      },
      { authData, logger }: WithLogger<AppContext<UIAuthData | M2MAuthData>>
    ): Promise<{ users: UserId[]; showUsers: boolean }> {
      logger.info(`Retrieving users of client ${clientId}`);
      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(authData, client.data);
      return {
        users: client.data.users,
        showUsers: true,
      };
    },
    async addClientUsers(
      {
        clientId,
        userIds,
      }: {
        clientId: ClientId;
        userIds: UserId[];
      },
      { authData, correlationId, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<{ client: Client; showUsers: boolean }> {
      logger.info(`Binding client ${clientId} with user ${userIds.join(",")}`);
      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(authData, client.data);

      await Promise.all(
        userIds.map((userId) =>
          assertUserSelfcareSecurityPrivileges({
            selfcareId: authData.selfcareId,
            requesterUserId: authData.userId,
            consumerId: authData.organizationId,
            selfcareV2InstitutionClient,
            userIdToCheck: userId,
            correlationId,
          })
        )
      );

      userIds.forEach((userId) => {
        if (client.data.users.includes(userId)) {
          throw clientUserAlreadyAssigned(clientId, userId);
        }
      });

      const uniqueUserIds = Array.from(new Set(userIds));
      const updatedClient: Client = {
        ...client.data,
      };

      await repository.createEvents(
        uniqueUserIds.map((userId, index) => {
          // eslint-disable-next-line functional/immutable-data
          updatedClient.users.push(userId);
          return toCreateEventClientUserAdded(
            userId,
            updatedClient,
            client.metadata.version + index,
            correlationId
          );
        })
      );

      return {
        client: updatedClient,
        showUsers: true,
      };
    },
    async getClientKeys(
      {
        clientId,
        userIds,
        offset,
        limit,
      }: {
        clientId: ClientId;
        userIds: UserId[];
        offset: number;
        limit: number;
      },
      { authData, logger }: WithLogger<AppContext<UIAuthData | M2MAuthData>>
    ): Promise<ListResult<Key>> {
      logger.info(
        `Retrieving keys for client ${clientId}, limit = ${limit}, offset = ${offset}`
      );
      const client = await retrieveClient(clientId, readModelService);

      assertSecurityRoleIsClientMember(authData, client.data);
      assertOrganizationIsClientConsumer(authData, client.data);

      const allKeys = client.data.keys;

      const filteredKeys =
        userIds && userIds.length > 0
          ? allKeys.filter((key) => userIds.includes(key.userId))
          : allKeys;

      return {
        results: filteredKeys.slice(offset, offset + limit),
        totalCount: filteredKeys.length,
      };
    },
    async addClientPurpose(
      {
        clientId,
        seed,
      }: {
        clientId: ClientId;
        seed: authorizationApi.PurposeAdditionDetails;
      },
      { logger, authData, correlationId }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> {
      logger.info(
        `Adding purpose with id ${seed.purposeId} to client ${clientId}`
      );
      const purposeId: PurposeId = unsafeBrandId(seed.purposeId);

      const client = await retrieveClient(clientId, readModelService);

      assertClientIsConsumer(client.data);

      assertOrganizationIsClientConsumer(authData, client.data);

      const purpose = await retrievePurpose(purposeId, readModelService);
      const delegation = await retrievePurposeDelegation(
        purpose,
        readModelService
      );

      const isDelegate =
        delegation && purpose.consumerId !== authData.organizationId;

      if (isDelegate) {
        assertRequesterIsDelegateConsumer(authData, purpose, delegation);
      } else {
        assertOrganizationIsPurposeConsumer(authData, purpose);
      }

      if (client.data.purposes.includes(purposeId)) {
        throw purposeAlreadyLinkedToClient(purposeId, client.data.id);
      }

      const eservice = await retrieveEService(
        purpose.eserviceId,
        readModelService
      );

      if (isDelegate && !eservice.isClientAccessDelegable) {
        throw eserviceNotDelegableForClientAccess(eservice);
      }

      const agreement = await readModelService.getActiveOrSuspendedAgreement(
        eservice.id,
        purpose.consumerId
      );

      if (agreement === undefined) {
        throw noAgreementFoundInRequiredState(eservice.id, purpose.consumerId);
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

    async createKey(
      {
        clientId,
        keySeed,
      }: {
        clientId: ClientId;
        keySeed: authorizationApi.KeySeed;
      },
      { logger, correlationId, authData }: WithLogger<AppContext<UIAuthData>>
    ): Promise<Key> {
      logger.info(`Creating keys for client ${clientId}`);
      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(authData, client.data);
      assertClientKeysCountIsBelowThreshold(
        clientId,
        client.data.keys.length + 1
      );
      if (!client.data.users.includes(authData.userId)) {
        throw userNotFound(authData.userId, authData.selfcareId);
      }

      await assertUserSelfcareSecurityPrivileges({
        selfcareId: authData.selfcareId,
        requesterUserId: authData.userId,
        consumerId: authData.organizationId,
        selfcareV2InstitutionClient,
        userIdToCheck: authData.userId,
        correlationId,
      });

      const jwk = createJWK(keySeed.key);
      const newKey: Key = {
        name: keySeed.name,
        createdAt: new Date(),
        kid: calculateKid(jwk),
        encodedPem: keySeed.key,
        algorithm: keySeed.alg,
        use: ApiKeyUseToKeyUse(keySeed.use),
        userId: authData.userId,
      };

      await assertKeyDoesNotAlreadyExist(newKey.kid, readModelService);

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

      return newKey;
    },
    async getClientKeyById(
      {
        clientId,
        kid,
      }: {
        clientId: ClientId;
        kid: string;
      },
      { logger, authData }: WithLogger<AppContext<UIAuthData | M2MAuthData>>
    ): Promise<Key> {
      logger.info(`Retrieving key ${kid} in client ${clientId}`);
      const client = await retrieveClient(clientId, readModelService);

      assertSecurityRoleIsClientMember(authData, client.data);

      assertOrganizationIsClientConsumer(authData, client.data);
      const key = client.data.keys.find((key) => key.kid === kid);

      if (!key) {
        throw clientKeyNotFound(kid, clientId);
      }
      return key;
    },
    async getKeyWithClientByKeyId(
      {
        clientId,
        kid,
      }: {
        clientId: ClientId;
        kid: string;
      },
      { logger }: WithLogger<AppContext<UIAuthData | M2MAuthData>>
    ): Promise<authorizationApi.KeyWithClient> {
      logger.info(`Getting client ${clientId} and key ${kid}`);
      const client = await retrieveClient(clientId, readModelService);
      const key = client.data.keys.find((key) => key.kid === kid);

      if (!key) {
        throw clientKeyNotFound(kid, clientId);
      }

      const jwk: JsonWebKey = createJWK(key.encodedPem);
      const jwkKey = authorizationApi.JWKKey.parse({
        ...jwk,
        kid: key.kid,
        use: "sig",
      });

      return {
        key: jwkKey,
        client: clientToApiClient(client.data, {
          showUsers: false,
        }),
      };
    },
    async createProducerKeychain(
      {
        producerKeychainSeed,
      }: {
        producerKeychainSeed: authorizationApi.ProducerKeychainSeed;
      },
      { logger, correlationId, authData }: WithLogger<AppContext<UIAuthData>>
    ): Promise<{ producerKeychain: ProducerKeychain; showUsers: boolean }> {
      logger.info(
        `Creating producer keychain ${producerKeychainSeed.name} for producer ${authData.organizationId}"`
      );

      const producerKeychain: ProducerKeychain = {
        id: generateId(),
        producerId: authData.organizationId,
        name: producerKeychainSeed.name,
        eservices: [],
        description: producerKeychainSeed.description,
        users: producerKeychainSeed.members.map(unsafeBrandId<UserId>),
        createdAt: new Date(),
        keys: [],
      };

      await repository.createEvent(
        toCreateEventProducerKeychainAdded(producerKeychain, correlationId)
      );

      return { producerKeychain, showUsers: true };
    },
    async getProducerKeychains(
      {
        filters,
        offset,
        limit,
      }: {
        filters: GetProducerKeychainsFilters;
        offset: number;
        limit: number;
      },
      { authData, logger }: WithLogger<AppContext<UIAuthData | M2MAuthData>>
    ): Promise<ListResult<ProducerKeychain>> {
      logger.info(
        `Retrieving producer keychains by name ${filters.name}, userIds ${filters.userIds}, producerId ${filters.producerId}, eserviceId ${filters.eserviceId}`
      );
      const userIds =
        isUiAuthData(authData) &&
        hasAtLeastOneUserRole(authData, [userRole.SECURITY_ROLE])
          ? [authData.userId]
          : filters.userIds;

      return await readModelService.getProducerKeychains(
        { ...filters, userIds },
        {
          offset,
          limit,
        }
      );
    },
    async getProducerKeychainById(
      {
        producerKeychainId,
      }: {
        producerKeychainId: ProducerKeychainId;
      },
      { logger, authData }: WithLogger<AppContext<UIAuthData | M2MAuthData>>
    ): Promise<{ producerKeychain: ProducerKeychain; showUsers: boolean }> {
      logger.info(`Retrieving Producer Keychain ${producerKeychainId}`);
      const producerKeychain = await retrieveProducerKeychain(
        producerKeychainId,
        readModelService
      );
      return {
        producerKeychain: producerKeychain.data,
        showUsers: authData.organizationId === producerKeychain.data.producerId,
      };
    },
    async deleteProducerKeychain(
      {
        producerKeychainId,
      }: {
        producerKeychainId: ProducerKeychainId;
      },
      { logger, correlationId, authData }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> {
      logger.info(`Deleting producer keychain ${producerKeychainId}`);

      const producerKeychain = await retrieveProducerKeychain(
        producerKeychainId,
        readModelService
      );
      assertOrganizationIsProducerKeychainProducer(
        authData,
        producerKeychain.data
      );

      await repository.createEvent(
        toCreateEventProducerKeychainDeleted(
          producerKeychain.data,
          producerKeychain.metadata.version,
          correlationId
        )
      );
    },
    async getProducerKeychainUsers(
      {
        producerKeychainId,
      }: {
        producerKeychainId: ProducerKeychainId;
      },
      { authData, logger }: WithLogger<AppContext<UIAuthData | M2MAuthData>>
    ): Promise<UserId[]> {
      logger.info(
        `Retrieving users of producer keychain ${producerKeychainId}`
      );
      const producerKeychain = await retrieveProducerKeychain(
        producerKeychainId,
        readModelService
      );
      assertOrganizationIsProducerKeychainProducer(
        authData,
        producerKeychain.data
      );
      return producerKeychain.data.users;
    },
    async addProducerKeychainUsers(
      {
        producerKeychainId,
        userIds,
      }: {
        producerKeychainId: ProducerKeychainId;
        userIds: UserId[];
      },
      { authData, correlationId, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<{ producerKeychain: ProducerKeychain; showUsers: boolean }> {
      logger.info(
        `Binding producer keychain ${producerKeychainId} with users ${userIds.join(
          ", "
        )}`
      );
      const producerKeychain = await retrieveProducerKeychain(
        producerKeychainId,
        readModelService
      );
      assertOrganizationIsProducerKeychainProducer(
        authData,
        producerKeychain.data
      );

      await Promise.all(
        userIds.map((userId) =>
          assertUserSelfcareSecurityPrivileges({
            selfcareId: authData.selfcareId,
            requesterUserId: authData.userId,
            consumerId: authData.organizationId,
            userIdToCheck: userId,
            selfcareV2InstitutionClient,
            correlationId,
          })
        )
      );

      userIds.forEach((userId) => {
        if (producerKeychain.data.users.includes(userId)) {
          throw producerKeychainUserAlreadyAssigned(producerKeychainId, userId);
        }
      });

      const uniqueUserIds = Array.from(new Set(userIds));
      const updatedProducerKeychain: ProducerKeychain = {
        ...producerKeychain.data,
      };

      await repository.createEvents(
        uniqueUserIds.map((userId, index) => {
          // eslint-disable-next-line functional/immutable-data
          updatedProducerKeychain.users.push(userId);
          return toCreateEventProducerKeychainUserAdded(
            userId,
            updatedProducerKeychain,
            producerKeychain.metadata.version + index,
            correlationId
          );
        })
      );

      return {
        producerKeychain: updatedProducerKeychain,
        showUsers: true,
      };
    },
    async removeProducerKeychainUser(
      {
        producerKeychainId,
        userIdToRemove,
      }: {
        producerKeychainId: ProducerKeychainId;
        userIdToRemove: UserId;
      },
      { logger, correlationId, authData }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> {
      logger.info(
        `Removing user ${userIdToRemove} from producer keychain ${producerKeychainId}`
      );

      const producerKeychain = await retrieveProducerKeychain(
        producerKeychainId,
        readModelService
      );
      assertOrganizationIsProducerKeychainProducer(
        authData,
        producerKeychain.data
      );

      if (!producerKeychain.data.users.includes(userIdToRemove)) {
        throw producerKeychainUserIdNotFound(
          userIdToRemove,
          producerKeychainId
        );
      }

      const updatedProducerKeychain: ProducerKeychain = {
        ...producerKeychain.data,
        users: producerKeychain.data.users.filter(
          (userId) => userId !== userIdToRemove
        ),
      };

      await repository.createEvent(
        toCreateEventProducerKeychainUserDeleted(
          updatedProducerKeychain,
          userIdToRemove,
          producerKeychain.metadata.version,
          correlationId
        )
      );
    },
    async createProducerKeychainKey(
      {
        producerKeychainId,
        keySeed,
      }: {
        producerKeychainId: ProducerKeychainId;
        keySeed: authorizationApi.KeySeed;
      },
      { logger, correlationId, authData }: WithLogger<AppContext<UIAuthData>>
    ): Promise<ProducerKeychain> {
      logger.info(`Creating keys for producer keychain ${producerKeychainId}`);
      const producerKeychain = await retrieveProducerKeychain(
        producerKeychainId,
        readModelService
      );
      assertOrganizationIsProducerKeychainProducer(
        authData,
        producerKeychain.data
      );
      assertProducerKeychainKeysCountIsBelowThreshold(
        producerKeychainId,
        producerKeychain.data.keys.length + 1
      );

      if (!producerKeychain.data.users.includes(authData.userId)) {
        throw userNotFound(authData.userId, authData.selfcareId);
      }

      await assertUserSelfcareSecurityPrivileges({
        selfcareId: authData.selfcareId,
        requesterUserId: authData.userId,
        consumerId: authData.organizationId,
        selfcareV2InstitutionClient,
        userIdToCheck: authData.userId,
        correlationId,
      });

      const jwk = createJWK(keySeed.key);
      const newKey: Key = {
        name: keySeed.name,
        createdAt: new Date(),
        kid: calculateKid(jwk),
        encodedPem: keySeed.key,
        algorithm: keySeed.alg,
        use: ApiKeyUseToKeyUse(keySeed.use),
        userId: authData.userId,
      };

      await assertKeyDoesNotAlreadyExist(newKey.kid, readModelService);

      const updatedProducerKeychain: ProducerKeychain = {
        ...producerKeychain.data,
        keys: [...producerKeychain.data.keys, newKey],
      };

      await repository.createEvent(
        toCreateEventProducerKeychainKeyAdded(
          newKey.kid,
          updatedProducerKeychain,
          producerKeychain.metadata.version,
          correlationId
        )
      );

      return updatedProducerKeychain;
    },
    async removeProducerKeychainKeyById(
      {
        producerKeychainId,
        keyIdToRemove,
      }: {
        producerKeychainId: ProducerKeychainId;
        keyIdToRemove: string;
      },
      { logger, correlationId, authData }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> {
      logger.info(
        `Removing key ${keyIdToRemove} from producer keychain ${producerKeychainId}`
      );

      const producerKeychain = await retrieveProducerKeychain(
        producerKeychainId,
        readModelService
      );
      assertOrganizationIsProducerKeychainProducer(
        authData,
        producerKeychain.data
      );

      const hasSecurityRole = hasAtLeastOneUserRole(authData, [
        userRole.SECURITY_ROLE,
      ]);

      if (
        hasSecurityRole &&
        !producerKeychain.data.users.includes(authData.userId)
      ) {
        throw userNotAllowedOnProducerKeychain(
          authData.userId,
          producerKeychain.data.id
        );
      }

      const keyToRemove = producerKeychain.data.keys.find(
        (key) => key.kid === keyIdToRemove
      );

      if (!keyToRemove) {
        throw producerKeyNotFound(keyIdToRemove, producerKeychain.data.id);
      }

      if (hasSecurityRole && keyToRemove.userId !== authData.userId) {
        throw userNotAllowedToDeleteProducerKeychainKey(
          authData.userId,
          producerKeychain.data.id,
          keyToRemove.kid
        );
      }

      const updatedProducerKeychain: ProducerKeychain = {
        ...producerKeychain.data,
        keys: producerKeychain.data.keys.filter(
          (key) => key.kid !== keyIdToRemove
        ),
      };

      await repository.createEvent(
        toCreateEventProducerKeychainKeyDeleted(
          updatedProducerKeychain,
          keyIdToRemove,
          producerKeychain.metadata.version,
          correlationId
        )
      );
    },
    async getProducerKeychainKeys(
      {
        producerKeychainId,
        userIds,
      }: {
        producerKeychainId: ProducerKeychainId;
        userIds: UserId[];
      },
      { authData, logger }: WithLogger<AppContext<UIAuthData | M2MAuthData>>
    ): Promise<Key[]> {
      logger.info(
        `Retrieving keys for producer keychain ${producerKeychainId}`
      );
      const producerKeychain = await retrieveProducerKeychain(
        producerKeychainId,
        readModelService
      );
      assertOrganizationIsProducerKeychainProducer(
        authData,
        producerKeychain.data
      );
      if (userIds.length > 0) {
        return producerKeychain.data.keys.filter((k) =>
          userIds.includes(k.userId)
        );
      }
      return producerKeychain.data.keys;
    },
    async getProducerKeychainKeyById(
      {
        producerKeychainId,
        kid,
      }: {
        producerKeychainId: ProducerKeychainId;
        kid: string;
      },
      { authData, logger }: WithLogger<AppContext<UIAuthData | M2MAuthData>>
    ): Promise<Key> {
      logger.info(
        `Retrieving key ${kid} in producerKeychain ${producerKeychainId}`
      );
      const producerKeychain = await retrieveProducerKeychain(
        producerKeychainId,
        readModelService
      );

      assertOrganizationIsProducerKeychainProducer(
        authData,
        producerKeychain.data
      );
      const key = producerKeychain.data.keys.find((key) => key.kid === kid);

      if (!key) {
        throw producerKeyNotFound(kid, producerKeychainId);
      }
      return key;
    },
    async addProducerKeychainEService(
      {
        producerKeychainId,
        seed,
      }: {
        producerKeychainId: ProducerKeychainId;
        seed: authorizationApi.EServiceAdditionDetails;
      },
      { authData, correlationId, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> {
      logger.info(
        `Adding eservice with id ${seed.eserviceId} to producer keychain ${producerKeychainId}`
      );
      const eserviceId: EServiceId = unsafeBrandId(seed.eserviceId);
      const producerKeychain = await retrieveProducerKeychain(
        producerKeychainId,
        readModelService
      );
      assertOrganizationIsProducerKeychainProducer(
        authData,
        producerKeychain.data
      );
      const eservice = await retrieveEService(eserviceId, readModelService);
      assertOrganizationIsEServiceProducer(authData, eservice);
      if (producerKeychain.data.eservices.includes(eserviceId)) {
        throw eserviceAlreadyLinkedToProducerKeychain(
          eserviceId,
          producerKeychain.data.id
        );
      }
      const updatedProducerKeychain: ProducerKeychain = {
        ...producerKeychain.data,
        eservices: [...producerKeychain.data.eservices, eserviceId],
      };
      await repository.createEvent(
        toCreateEventProducerKeychainEServiceAdded(
          eserviceId,
          updatedProducerKeychain,
          producerKeychain.metadata.version,
          correlationId
        )
      );
    },
    async removeProducerKeychainEService(
      {
        producerKeychainId,
        eserviceIdToRemove,
      }: {
        producerKeychainId: ProducerKeychainId;
        eserviceIdToRemove: EServiceId;
      },
      { authData, correlationId, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> {
      logger.info(
        `Removing e-service ${eserviceIdToRemove} from producer keychain ${producerKeychainId}`
      );

      const producerKeychain = await retrieveProducerKeychain(
        producerKeychainId,
        readModelService
      );
      assertOrganizationIsProducerKeychainProducer(
        authData,
        producerKeychain.data
      );

      if (
        !producerKeychain.data.eservices.find((id) => id === eserviceIdToRemove)
      ) {
        throw eserviceNotFound(eserviceIdToRemove);
      }

      const updatedProducerKeychain: ProducerKeychain = {
        ...producerKeychain.data,
        eservices: producerKeychain.data.eservices.filter(
          (eserviceId) => eserviceId !== eserviceIdToRemove
        ),
      };

      await repository.createEvent(
        toCreateEventProducerKeychainEServiceRemoved(
          updatedProducerKeychain,
          eserviceIdToRemove,
          producerKeychain.metadata.version,
          correlationId
        )
      );
    },
  };
}

export type AuthorizationService = ReturnType<
  typeof authorizationServiceBuilder
>;
