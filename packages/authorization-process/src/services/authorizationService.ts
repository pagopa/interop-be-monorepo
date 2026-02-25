import { JsonWebKey } from "crypto";
import {
  authorizationEventToBinaryData,
  Client,
  ClientId,
  clientKind,
  Delegation,
  Descriptor,
  DescriptorId,
  emptyListResult,
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
  Tenant,
  TenantId,
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
  M2MAdminAuthData,
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
  clientAdminAlreadyAssignedToUser,
  clientKeyNotFound,
  clientNotFound,
  clientUserAlreadyAssigned,
  clientUserIdNotFound,
  descriptorNotFound,
  eserviceAlreadyLinkedToProducerKeychain,
  eserviceNotDelegableForClientAccess,
  eserviceNotFound,
  jwkNotFound,
  producerJwkNotFound,
  noActiveOrSuspendedAgreementFound,
  noActiveOrSuspendedPurposeVersionFound,
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
  tenantNotFound,
} from "../model/domain/errors.js";
import {
  toCreateEventClientAdded,
  toCreateEventClientAdminSet,
  toCreateEventClientAdminRemoved,
  toCreateEventClientAdminRoleRevoked,
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
  clientJWKToApiClientJWK,
  producerJWKToApiProducerJWK,
} from "../model/domain/apiConverter.js";
import {
  GetClientsFilters,
  GetProducerKeychainsFilters,
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
  assertClientIsAPI,
  assertAdminInClient,
  assertTenantHasSelfcareId,
} from "./validators.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

const retrieveClient = async (
  clientId: ClientId,
  readModelService: ReadModelServiceSQL
): Promise<WithMetadata<Client>> => {
  const client = await readModelService.getClientById(clientId);
  if (!client) {
    throw clientNotFound(clientId);
  }
  return client;
};

const retrieveEService = async (
  eserviceId: EServiceId,
  readModelService: ReadModelServiceSQL
): Promise<EService> => {
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (eservice === undefined) {
    throw eserviceNotFound(eserviceId);
  }
  return eservice;
};

const retrievePurpose = async (
  purposeId: PurposeId,
  readModelService: ReadModelServiceSQL
): Promise<Purpose> => {
  const purpose = await readModelService.getPurposeById(purposeId);
  if (purpose === undefined) {
    throw purposeNotFound(purposeId);
  }
  return purpose;
};

const retrievePurposeDelegation = async (
  purpose: Purpose,
  readModelService: ReadModelServiceSQL
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
  readModelService: ReadModelServiceSQL
): Promise<WithMetadata<ProducerKeychain>> => {
  const producerKeychain =
    await readModelService.getProducerKeychainById(producerKeychainId);
  if (!producerKeychain) {
    throw producerKeychainNotFound(producerKeychainId);
  }
  return producerKeychain;
};

const retrieveTenant = async (
  tenantId: TenantId,
  readModelService: ReadModelServiceSQL
): Promise<Tenant> => {
  const tenant = await readModelService.getTenantById(tenantId);
  if (tenant === undefined) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
};

const getSelfcareIdFromAuthData = async (
  authData: UIAuthData | M2MAdminAuthData,
  readModelService: ReadModelServiceSQL
): Promise<string> => {
  const tenant = await retrieveTenant(
    authData.organizationId,
    readModelService
  );

  assertTenantHasSelfcareId(tenant);

  return tenant.selfcareId;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function authorizationServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelServiceSQL,
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
      {
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Client>> {
      logger.info(`Retrieving Client ${clientId}`);
      return await retrieveClient(clientId, readModelService);
    },

    async createConsumerClient(
      {
        clientSeed,
      }: {
        clientSeed: authorizationApi.ClientSeed;
      },
      { logger, correlationId, authData }: WithLogger<AppContext<UIAuthData>>
    ): Promise<Client> {
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

      return client;
    },
    async createApiClient(
      {
        clientSeed,
      }: {
        clientSeed: authorizationApi.ClientSeed;
      },
      { logger, correlationId, authData }: WithLogger<AppContext<UIAuthData>>
    ): Promise<Client> {
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

      return client;
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
      {
        authData,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<ListResult<Client>> {
      logger.info(
        `Retrieving clients by name ${filters.name} , userIds ${filters.userIds}`
      );

      // Some filters apply only to clients owned by the caller
      // (i.e., where the caller is the consumer of the client).
      // That's because they filter fields that are only visible to the owner.
      const areOwnerFiltersSet =
        (filters.userIds && filters.userIds.length > 0) ||
        filters.purposeId ||
        filters.name;

      if (
        areOwnerFiltersSet &&
        filters.consumerId &&
        filters.consumerId !== authData.organizationId
      ) {
        // consumer filter (owner) differs from the caller,
        // cannot apply owner-specific filters -> return empty list
        return emptyListResult;
      }

      const consumerId = areOwnerFiltersSet
        ? authData.organizationId
        : filters.consumerId;
      // ^ If owner-specific filters are set,
      // we restrict the results to clients with the caller as the consumer (owner).

      const userIds =
        isUiAuthData(authData) &&
        hasAtLeastOneUserRole(authData, [userRole.SECURITY_ROLE])
          ? [authData.userId]
          : filters.userIds;

      return await readModelService.getClients(
        {
          name: filters.name,
          kind: filters.kind,
          purposeId: filters.purposeId,
          userIds,
          consumerId,
        },
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
      {
        logger,
        correlationId,
        authData,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Client>> {
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

      const createdEvent = await repository.createEvent(
        toCreateEventClientUserDeleted(
          updatedClient,
          userIdToRemove,
          client.metadata.version,
          correlationId
        )
      );
      return {
        data: updatedClient,
        metadata: {
          version: createdEvent.newVersion,
        },
      };
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
      {
        correlationId,
        authData,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Client>> {
      logger.info(
        `Removing purpose ${purposeIdToRemove} from client ${clientId}`
      );

      const client = await retrieveClient(clientId, readModelService);

      assertClientIsConsumer(client.data);

      assertOrganizationIsClientConsumer(authData, client.data);

      const updatedClient: Client = {
        ...client.data,
        purposes: client.data.purposes.filter(
          (purposeId) => purposeId !== purposeIdToRemove
        ),
      };

      const createdEvent = await repository.createEvent(
        toCreateEventClientPurposeRemoved(
          updatedClient,
          purposeIdToRemove,
          client.metadata.version,
          correlationId
        )
      );

      return {
        data: updatedClient,
        metadata: {
          version: createdEvent.newVersion,
        },
      };
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

      const clients =
        await readModelService.getClientsRelatedToPurpose(purposeIdToRemove);
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
      {
        authData,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<UserId[]> {
      logger.info(`Retrieving users of client ${clientId}`);
      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(authData, client.data);
      return client.data.users;
    },
    async addClientUsers(
      {
        clientId,
        userIds,
      }: {
        clientId: ClientId;
        userIds: UserId[];
      },
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Client>> {
      logger.info(`Binding client ${clientId} with user ${userIds.join(",")}`);
      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(authData, client.data);
      const selfcareId = isUiAuthData(authData)
        ? authData.selfcareId
        : await getSelfcareIdFromAuthData(authData, readModelService);

      await Promise.all(
        userIds.map((userId) =>
          assertUserSelfcareSecurityPrivileges({
            selfcareId,
            requesterUserId: authData.userId,
            consumerId: authData.organizationId,
            selfcareV2InstitutionClient,
            userIdToCheck: userId,
            correlationId,
            userRolesToCheck: [userRole.ADMIN_ROLE, userRole.SECURITY_ROLE],
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

      const createdEvents = await repository.createEvents(
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
        data: updatedClient,
        metadata: {
          version: createdEvents.latestNewVersions.get(updatedClient.id) ?? 0,
        },
      };
    },
    async setAdminToClient(
      {
        clientId,
        adminId,
      }: {
        clientId: ClientId;
        adminId: UserId;
      },
      { authData, correlationId, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<Client> {
      logger.info(`Set user ${adminId} in client ${clientId} as admin`);

      await assertUserSelfcareSecurityPrivileges({
        selfcareId: authData.selfcareId,
        requesterUserId: authData.userId,
        consumerId: authData.organizationId,
        userIdToCheck: adminId,
        selfcareV2InstitutionClient,
        correlationId,
        userRolesToCheck: [userRole.ADMIN_ROLE],
      });

      const client = await retrieveClient(clientId, readModelService);
      assertClientIsAPI(client.data);
      assertOrganizationIsClientConsumer(authData, client.data);

      const oldAdminId = client.data.adminId;
      if (oldAdminId && oldAdminId === adminId) {
        throw clientAdminAlreadyAssignedToUser(clientId, adminId);
      }

      const updatedClient: Client = {
        ...client.data,
        adminId,
      };

      await repository.createEvent(
        toCreateEventClientAdminSet(
          adminId,
          updatedClient,
          client.metadata.version,
          correlationId,
          oldAdminId
        )
      );
      return updatedClient;
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
      {
        authData,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
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
      {
        logger,
        authData,
        correlationId,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Client>> {
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
        throw noActiveOrSuspendedAgreementFound(
          eservice.id,
          purpose.consumerId
        );
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
        throw noActiveOrSuspendedPurposeVersionFound(purpose.id);
      }

      const updatedClient: Client = {
        ...client.data,
        purposes: [...client.data.purposes, purposeId],
      };

      const event = await repository.createEvent(
        toCreateEventClientPurposeAdded(
          purposeId,
          updatedClient,
          client.metadata.version,
          correlationId
        )
      );

      return {
        data: updatedClient,
        metadata: {
          version: event.newVersion,
        },
      };
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
        userRolesToCheck: [userRole.ADMIN_ROLE, userRole.SECURITY_ROLE],
      });

      const jwk = createJWK({ pemKeyBase64: keySeed.key });
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
    ): Promise<{
      jwk: JsonWebKey;
      kid: string;
      client: Client;
    }> {
      logger.info(`Getting client ${clientId} and key ${kid}`);
      const { data: client } = await retrieveClient(clientId, readModelService);
      const key = client.keys.find((key) => key.kid === kid);

      if (!key) {
        throw clientKeyNotFound(kid, clientId);
      }

      const jwk: JsonWebKey = createJWK({
        pemKeyBase64: key.encodedPem,
      });

      return {
        jwk,
        kid: key.kid,
        client,
      };
    },
    async createProducerKeychain(
      {
        producerKeychainSeed,
      }: {
        producerKeychainSeed: authorizationApi.ProducerKeychainSeed;
      },
      { logger, correlationId, authData }: WithLogger<AppContext<UIAuthData>>
    ): Promise<ProducerKeychain> {
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

      return producerKeychain;
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
      {
        authData,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<ListResult<ProducerKeychain>> {
      logger.info(
        `Retrieving producer keychains by name ${filters.name}, userIds ${filters.userIds}, producerId ${filters.producerId}, eserviceId ${filters.eserviceId}`
      );

      // Some filters apply only to keychains owned by the caller
      // (i.e., where the caller is the producer of the keychain).
      // That's because they filter fields that are only visible to the owner.
      const areOwnerFiltersSet =
        (filters.userIds && filters.userIds.length > 0) ||
        filters.eserviceId ||
        filters.name;

      if (
        areOwnerFiltersSet &&
        filters.producerId &&
        filters.producerId !== authData.organizationId
      ) {
        // producer filter (owner) differs from the caller,
        // cannot apply owner-specific filters -> return empty list
        return emptyListResult;
      }

      const producerId = areOwnerFiltersSet
        ? authData.organizationId
        : filters.producerId;
      // ^ If owner-specific filters are set,
      // we restrict the results to keychains with the caller as the producer (owner).

      const userIds =
        isUiAuthData(authData) &&
        hasAtLeastOneUserRole(authData, [userRole.SECURITY_ROLE])
          ? [authData.userId]
          : filters.userIds;

      return await readModelService.getProducerKeychains(
        {
          eserviceId: filters.eserviceId,
          name: filters.name,
          userIds,
          producerId,
        },
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
      {
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<ProducerKeychain>> {
      logger.info(`Retrieving Producer Keychain ${producerKeychainId}`);
      return await retrieveProducerKeychain(
        producerKeychainId,
        readModelService
      );
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
      {
        authData,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
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
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<ProducerKeychain>> {
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
      const selfcareId = isUiAuthData(authData)
        ? authData.selfcareId
        : await getSelfcareIdFromAuthData(authData, readModelService);

      await Promise.all(
        userIds.map((userId) =>
          assertUserSelfcareSecurityPrivileges({
            selfcareId,
            requesterUserId: authData.userId,
            consumerId: authData.organizationId,
            userIdToCheck: userId,
            selfcareV2InstitutionClient,
            correlationId,
            userRolesToCheck: [userRole.ADMIN_ROLE, userRole.SECURITY_ROLE],
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

      const createdEvents = await repository.createEvents(
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
        data: updatedProducerKeychain,
        metadata: {
          version:
            createdEvents.latestNewVersions.get(updatedProducerKeychain.id) ??
            0,
        },
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
      {
        logger,
        correlationId,
        authData,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<ProducerKeychain>> {
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

      const createdEvent = await repository.createEvent(
        toCreateEventProducerKeychainUserDeleted(
          updatedProducerKeychain,
          userIdToRemove,
          producerKeychain.metadata.version,
          correlationId
        )
      );
      return {
        data: updatedProducerKeychain,
        metadata: {
          version: createdEvent.newVersion,
        },
      };
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
    ): Promise<Key> {
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
        userRolesToCheck: [userRole.ADMIN_ROLE, userRole.SECURITY_ROLE],
      });

      const jwk = createJWK({ pemKeyBase64: keySeed.key });
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

      return newKey;
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
        offset,
        limit,
      }: {
        producerKeychainId: ProducerKeychainId;
        userIds: UserId[];
        offset: number;
        limit: number;
      },
      {
        authData,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<ListResult<Key>> {
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
      const allKeys = producerKeychain.data.keys;

      const filteredKeys =
        userIds && userIds.length > 0
          ? allKeys.filter((key) => userIds.includes(key.userId))
          : allKeys;

      return {
        results: filteredKeys.slice(offset, offset + limit),
        totalCount: filteredKeys.length,
      };
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
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<ProducerKeychain>> {
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

      const createdEvent = await repository.createEvent(
        toCreateEventProducerKeychainEServiceAdded(
          eserviceId,
          updatedProducerKeychain,
          producerKeychain.metadata.version,
          correlationId
        )
      );

      return {
        data: updatedProducerKeychain,
        metadata: {
          version: createdEvent.newVersion,
        },
      };
    },
    async removeProducerKeychainEService(
      {
        producerKeychainId,
        eserviceIdToRemove,
      }: {
        producerKeychainId: ProducerKeychainId;
        eserviceIdToRemove: EServiceId;
      },
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<ProducerKeychain>> {
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

      const createdEvent = await repository.createEvent(
        toCreateEventProducerKeychainEServiceRemoved(
          updatedProducerKeychain,
          eserviceIdToRemove,
          producerKeychain.metadata.version,
          correlationId
        )
      );

      return {
        data: updatedProducerKeychain,
        metadata: {
          version: createdEvent.newVersion,
        },
      };
    },
    async internalRemoveClientAdmin(
      clientId: ClientId,
      adminId: UserId,
      { correlationId, logger }: WithLogger<AppContext<InternalAuthData>>
    ): Promise<void> {
      logger.info(`Removing client admin ${adminId} from client ${clientId}`);
      const client = await retrieveClient(clientId, readModelService);

      assertClientIsAPI(client.data);
      assertAdminInClient(client.data, adminId);

      const updatedClient: Client = {
        ...client.data,
        adminId: undefined,
      };

      await repository.createEvent(
        toCreateEventClientAdminRoleRevoked(
          updatedClient,
          adminId,
          client.metadata.version,
          correlationId
        )
      );
    },
    async removeClientAdmin(
      { clientId, adminId }: { clientId: ClientId; adminId: UserId },
      { correlationId, logger, authData }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> {
      logger.info(`Removing client admin ${adminId} from client ${clientId}`);
      const client = await retrieveClient(clientId, readModelService);

      assertOrganizationIsClientConsumer(authData, client.data);
      assertClientIsAPI(client.data);
      assertAdminInClient(client.data, adminId);

      const updatedClient: Client = {
        ...client.data,
        adminId: undefined,
      };

      await repository.createEvent(
        toCreateEventClientAdminRemoved(
          updatedClient,
          adminId,
          client.metadata.version,
          correlationId
        )
      );
    },
    async getJWKByKid(
      kid: string,
      {
        logger,
      }: WithLogger<AppContext<M2MAdminAuthData | UIAuthData | M2MAuthData>>
    ): Promise<authorizationApi.ClientJWK> {
      logger.info(`Retrieving key with id ${kid}`);

      const clientKey = await readModelService.getClientJWKByKId(kid);

      if (!clientKey) {
        throw jwkNotFound(kid);
      }

      return clientJWKToApiClientJWK(clientKey);
    },
    async getProducerJWKByKid(
      kid: string,
      {
        logger,
      }: WithLogger<AppContext<M2MAdminAuthData | UIAuthData | M2MAuthData>>
    ): Promise<authorizationApi.ProducerJWK> {
      logger.info(`Retrieving key with id ${kid}`);

      const producerKey = await readModelService.getProducerJWKByKId(kid);

      if (!producerKey) {
        throw producerJwkNotFound(kid);
      }

      return producerJWKToApiProducerJWK(producerKey);
    },
  };
}

export type AuthorizationService = ReturnType<
  typeof authorizationServiceBuilder
>;
