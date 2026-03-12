/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockClient,
  getMockTokenGenStatesApiClient,
  getMockTokenGenStatesConsumerClient,
  readAllPlatformStatesItems,
  readAllTokenGenStatesItems,
  getMockPurpose,
  getMockPurposeVersion,
  writePlatformPurposeEntry,
  getMockAgreement,
  writePlatformAgreementEntry,
  getMockDescriptor,
  writePlatformCatalogEntry,
  getMockKey,
  writeTokenGenStatesConsumerClient,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AuthorizationEventEnvelope,
  Client,
  ClientAddedV1,
  ClientComponentStateV1,
  ClientDeletedV1,
  ClientId,
  clientKindTokenGenStates,
  ClientPurposeAddedV1,
  ClientPurposeRemovedV1,
  Descriptor,
  generateId,
  itemState,
  KeyDeletedV1,
  KeysAddedV1,
  makeGSIPKClientIdPurposeId,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makeGSIPKClientIdKid,
  makePlatformStatesAgreementPK,
  makePlatformStatesClientPK,
  makePlatformStatesEServiceDescriptorPK,
  makePlatformStatesPurposePK,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  PlatformStatesAgreementEntry,
  PlatformStatesCatalogEntry,
  PlatformStatesClientEntry,
  PlatformStatesPurposeEntry,
  Purpose,
  PurposeId,
  purposeVersionState,
  TenantId,
  toClientV1,
  TokenGenerationStatesApiClient,
  TokenGenerationStatesConsumerClient,
  toKeyV1,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { handleMessageV1 } from "../src/consumerServiceV1.js";
import {
  clientKindToTokenGenerationStatesClientKind,
  readPlatformClientEntry,
  writePlatformClientEntry,
  writeTokenGenStatesApiClient,
} from "../src/utils.js";
import { dynamoDBClient } from "./utils.js";

describe("integration tests V1 events", async () => {
  beforeEach(async () => {
    await buildDynamoDBTables(dynamoDBClient);
  });
  afterEach(async () => {
    await deleteDynamoDBTables(dynamoDBClient);
  });
  const mockDate = new Date();
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  describe("ClientAdded", () => {
    it("should do no operation if the existing table entry is more recent", async () => {
      const previousPlatformEntryVersion = 2;
      const messageVersion = 1;

      const client = getMockClient();

      const payload: ClientAddedV1 = {
        client: toClientV1(client),
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientAdded",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformClientPK = makePlatformStatesClientPK(client.id);
      const previousPlatformClientEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        version: previousPlatformEntryVersion,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [],
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toEqual(previousPlatformClientEntry);
    });

    it("should add the entry if it doesn't exist", async () => {
      const messageVersion = 1;

      const client = getMockClient();

      const payload: ClientAddedV1 = {
        client: toClientV1(client),
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientAdded",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformClientPK = makePlatformStatesClientPK(client.id);
      expect(
        await readPlatformClientEntry(platformClientPK, dynamoDBClient)
      ).toBeUndefined();

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformClientEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        version: messageVersion,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: client.purposes,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
      };
      expect(retrievedPlatformClientEntry).toEqual(expectedPlatformClientEntry);
    });

    it("should update the entry", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const client = getMockClient();

      const payload: ClientAddedV1 = {
        client: toClientV1(client),
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientAdded",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformClientPK = makePlatformStatesClientPK(client.id);
      const previousPlatformClientEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        version: previousPlatformEntryVersion,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [],
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformClientEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        version: messageVersion,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: client.purposes,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
      };
      expect(retrievedPlatformClientEntry).toEqual(expectedPlatformClientEntry);
    });
  });

  describe("KeysAdded", () => {
    it("should do no operation if the existing table entry is more recent", async () => {
      const previousPlatformEntryVersion = 2;
      const messageVersion = 1;

      const key = getMockKey();
      const client: Client = {
        ...getMockClient(),
        keys: [key],
      };

      const payload: KeysAddedV1 = {
        clientId: client.id,
        keys: [
          {
            keyId: generateId(),
            value: toKeyV1(key),
          },
        ],
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "KeysAdded",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformClientPK = makePlatformStatesClientPK(client.id);
      const previousPlatformClientEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        version: previousPlatformEntryVersion,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [generateId<PurposeId>()],
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: key.kid,
      });
      const tokenClientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK),
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: key.kid,
        }),
      };
      await writeTokenGenStatesApiClient(
        tokenClientEntry,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toEqual(previousPlatformClientEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toEqual([tokenClientEntry]);
    });

    it("should do no operation if the existing table entry doesn't exist", async () => {
      const messageVersion = 2;

      const key = getMockKey();
      const client: Client = {
        ...getMockClient(),
        keys: [key],
      };

      const payload: KeysAddedV1 = {
        clientId: client.id,
        keys: [
          {
            keyId: generateId(),
            value: toKeyV1(key),
          },
        ],
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "KeysAdded",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformClientPK = makePlatformStatesClientPK(client.id);
      expect(
        await readPlatformClientEntry(platformClientPK, dynamoDBClient)
      ).toBeUndefined();

      // token-generation-states
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: key.kid,
      });
      const tokenClientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK),
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: key.kid,
        }),
      };
      await writeTokenGenStatesApiClient(
        tokenClientEntry,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toEqual([tokenClientEntry]);
    });

    it("should update platform-states entry and insert token-generation-states client-kid-purpose entries if the client contains at least one purpose", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const consumerId = generateId<TenantId>();
      const purpose1: Purpose = {
        ...getMockPurpose(),
        consumerId,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const purpose2: Purpose = {
        ...getMockPurpose(),
        consumerId,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const oldKey = getMockKey();
      const addedKey = getMockKey();
      const client: Client = {
        ...getMockClient(),
        consumerId,
        keys: [oldKey, addedKey],
        purposes: [purpose1.id, purpose2.id],
      };

      const payload: KeysAddedV1 = {
        clientId: client.id,
        keys: [
          {
            keyId: generateId(),
            value: toKeyV1(addedKey),
          },
        ],
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "KeysAdded",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformPurposeEntry1: PlatformStatesPurposeEntry = {
        PK: makePlatformStatesPurposePK(purpose1.id),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        purposeVersionId: purpose1.versions[0].id,
        purposeEserviceId: purpose1.eserviceId,
        purposeConsumerId: purpose1.consumerId,
      };
      await writePlatformPurposeEntry(platformPurposeEntry1, dynamoDBClient);

      const platformPurposeEntry2: PlatformStatesPurposeEntry = {
        PK: makePlatformStatesPurposePK(purpose2.id),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        purposeVersionId: purpose2.versions[0].id,
        purposeEserviceId: purpose2.eserviceId,
        purposeConsumerId: purpose2.consumerId,
      };
      await writePlatformPurposeEntry(platformPurposeEntry2, dynamoDBClient);

      const agreement1: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId: purpose1.eserviceId,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const platformAgreementEntry1: PlatformStatesAgreementEntry = {
        PK: makePlatformStatesAgreementPK({
          consumerId,
          eserviceId: agreement1.eserviceId,
        }),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        agreementId: agreement1.id,
        agreementTimestamp: agreement1.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement1.descriptorId,
        producerId: agreement1.producerId,
      };
      await writePlatformAgreementEntry(
        platformAgreementEntry1,
        dynamoDBClient
      );

      const agreement2: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId: purpose2.eserviceId,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const platformAgreementEntry2: PlatformStatesAgreementEntry = {
        PK: makePlatformStatesAgreementPK({
          consumerId,
          eserviceId: agreement2.eserviceId,
        }),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        agreementId: agreement2.id,
        agreementTimestamp: agreement2.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement2.descriptorId,
        producerId: agreement2.producerId,
      };
      await writePlatformAgreementEntry(
        platformAgreementEntry2,
        dynamoDBClient
      );

      const descriptor1: Descriptor = {
        ...getMockDescriptor(),
        id: agreement1.descriptorId,
      };
      const previousDescriptorEntry1: PlatformStatesCatalogEntry = {
        PK: makePlatformStatesEServiceDescriptorPK({
          eserviceId: purpose1.eserviceId,
          descriptorId: descriptor1.id,
        }),
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: descriptor1.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousDescriptorEntry1, dynamoDBClient);

      const descriptor2: Descriptor = {
        ...getMockDescriptor(),
        id: agreement2.descriptorId,
      };
      const previousDescriptorEntry2: PlatformStatesCatalogEntry = {
        PK: makePlatformStatesEServiceDescriptorPK({
          eserviceId: purpose2.eserviceId,
          descriptorId: descriptor2.id,
        }),
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: descriptor2.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousDescriptorEntry2, dynamoDBClient);

      const platformClientPK = makePlatformStatesClientPK(client.id);
      const previousPlatformClientEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        version: previousPlatformEntryVersion,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [purpose1.id, purpose2.id],
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenClientKidPurposePK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: oldKey.kid,
          purposeId: purpose1.id,
        });
      const tokenClientKidPurposePK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: oldKey.kid,
          purposeId: purpose2.id,
        });
      const gsiPKClientIdPurposeId1 = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: purpose1.id,
      });
      const gsiPKClientIdPurposeId2 = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: purpose2.id,
      });
      const GSIPK_clientId_kid = makeGSIPKClientIdKid({
        clientId: client.id,
        kid: oldKey.kid,
      });
      const tokenConsumerClient1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK1),
        consumerId: client.consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid,
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId1,
        GSIPK_purposeId: purpose1.id,
      };
      const tokenConsumerClient2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK2),
        consumerId: client.consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid,
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId2,
        GSIPK_purposeId: purpose2.id,
      };
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient1,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        ...previousPlatformClientEntry,
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformClientEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenConsumerClient1,
          PK: makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            kid: addedKey.kid,
            purposeId: purpose1.id,
          }),
          GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
            consumerId,
            eserviceId: agreement1.eserviceId,
          }),
          agreementId: agreement1.id,
          agreementState: platformAgreementEntry1.state,
          producerId: agreement1.producerId,
          GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
            eserviceId: agreement1.eserviceId,
            descriptorId: descriptor1.id,
          }),
          descriptorState: previousDescriptorEntry1.state,
          descriptorAudience: previousDescriptorEntry1.descriptorAudience,
          descriptorVoucherLifespan:
            previousDescriptorEntry1.descriptorVoucherLifespan,
          GSIPK_purposeId: purpose1.id,
          purposeState: platformPurposeEntry1.state,
          purposeVersionId: platformPurposeEntry1.purposeVersionId,
          publicKey: addedKey.encodedPem,
          GSIPK_clientId_kid: makeGSIPKClientIdKid({
            clientId: client.id,
            kid: addedKey.kid,
          }),
          GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
            clientId: client.id,
            purposeId: purpose1.id,
          }),
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenConsumerClient2,
          PK: makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            kid: addedKey.kid,
            purposeId: purpose2.id,
          }),
          GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
            consumerId,
            eserviceId: agreement2.eserviceId,
          }),
          agreementId: agreement2.id,
          agreementState: platformAgreementEntry2.state,
          producerId: agreement2.producerId,
          GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
            eserviceId: agreement2.eserviceId,
            descriptorId: descriptor2.id,
          }),
          descriptorState: previousDescriptorEntry2.state,
          descriptorAudience: previousDescriptorEntry2.descriptorAudience,
          descriptorVoucherLifespan:
            previousDescriptorEntry2.descriptorVoucherLifespan,
          GSIPK_purposeId: purpose2.id,
          purposeState: platformPurposeEntry2.state,
          purposeVersionId: platformPurposeEntry2.purposeVersionId,
          publicKey: addedKey.encodedPem,
          GSIPK_clientId_kid: makeGSIPKClientIdKid({
            clientId: client.id,
            kid: addedKey.kid,
          }),
          GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
            clientId: client.id,
            purposeId: purpose2.id,
          }),
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(4);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenConsumerClient1,
          tokenConsumerClient2,
          expectedTokenConsumerClient1,
          expectedTokenConsumerClient2,
        ])
      );
    });

    it("should update platform-states entry and update token-generation-states client-kid-purpose entries", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const consumerId = generateId<TenantId>();
      const purpose1: Purpose = {
        ...getMockPurpose(),
        consumerId,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const purpose2: Purpose = {
        ...getMockPurpose(),
        consumerId,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const oldKey = getMockKey();
      const addedKey = getMockKey();
      const client: Client = {
        ...getMockClient(),
        consumerId,
        keys: [oldKey, addedKey],
        purposes: [purpose1.id, purpose2.id],
      };

      const payload: KeysAddedV1 = {
        clientId: client.id,
        keys: [
          {
            keyId: generateId(),
            value: toKeyV1(addedKey),
          },
        ],
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "KeysAdded",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformPurposeEntry1: PlatformStatesPurposeEntry = {
        PK: makePlatformStatesPurposePK(purpose1.id),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        purposeVersionId: purpose1.versions[0].id,
        purposeEserviceId: purpose1.eserviceId,
        purposeConsumerId: purpose1.consumerId,
      };
      await writePlatformPurposeEntry(platformPurposeEntry1, dynamoDBClient);

      const platformPurposeEntry2: PlatformStatesPurposeEntry = {
        PK: makePlatformStatesPurposePK(purpose2.id),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        purposeVersionId: purpose2.versions[0].id,
        purposeEserviceId: purpose2.eserviceId,
        purposeConsumerId: purpose2.consumerId,
      };
      await writePlatformPurposeEntry(platformPurposeEntry2, dynamoDBClient);

      const agreement1: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId: purpose1.eserviceId,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const platformAgreementEntry1: PlatformStatesAgreementEntry = {
        PK: makePlatformStatesAgreementPK({
          consumerId,
          eserviceId: agreement1.eserviceId,
        }),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        agreementId: agreement1.id,
        agreementTimestamp: agreement1.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement1.descriptorId,
        producerId: agreement1.producerId,
      };
      await writePlatformAgreementEntry(
        platformAgreementEntry1,
        dynamoDBClient
      );

      const agreement2: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId: purpose2.eserviceId,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const platformAgreementEntry2: PlatformStatesAgreementEntry = {
        PK: makePlatformStatesAgreementPK({
          consumerId,
          eserviceId: agreement2.eserviceId,
        }),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        agreementId: agreement2.id,
        agreementTimestamp: agreement2.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement2.descriptorId,
        producerId: agreement2.producerId,
      };
      await writePlatformAgreementEntry(
        platformAgreementEntry2,
        dynamoDBClient
      );

      const descriptor1: Descriptor = {
        ...getMockDescriptor(),
        id: agreement1.descriptorId,
      };
      const previousDescriptorEntry1: PlatformStatesCatalogEntry = {
        PK: makePlatformStatesEServiceDescriptorPK({
          eserviceId: purpose1.eserviceId,
          descriptorId: descriptor1.id,
        }),
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: descriptor1.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousDescriptorEntry1, dynamoDBClient);

      const descriptor2: Descriptor = {
        ...getMockDescriptor(),
        id: agreement2.descriptorId,
      };
      const previousDescriptorEntry2: PlatformStatesCatalogEntry = {
        PK: makePlatformStatesEServiceDescriptorPK({
          eserviceId: purpose2.eserviceId,
          descriptorId: descriptor2.id,
        }),
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: descriptor2.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousDescriptorEntry2, dynamoDBClient);

      const platformClientPK = makePlatformStatesClientPK(client.id);
      const previousPlatformClientEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        version: previousPlatformEntryVersion,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [purpose1.id, purpose2.id],
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenClientKidPurposePK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: oldKey.kid,
          purposeId: purpose1.id,
        });
      const tokenClientKidPurposePK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: oldKey.kid,
          purposeId: purpose2.id,
        });
      const tokenClientKidPurposePK3 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: addedKey.kid,
          purposeId: purpose1.id,
        });
      const tokenClientKidPurposePK4 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: addedKey.kid,
          purposeId: purpose2.id,
        });

      const gsiPKClientIdPurposeId1 = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: purpose1.id,
      });
      const gsiPKClientIdPurposeId2 = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: purpose2.id,
      });
      const gsiPKClientIdPurposeId3 = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: purpose1.id,
      });
      const gsiPKClientIdPurposeId4 = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: purpose2.id,
      });

      const tokenConsumerClient1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK1),
        consumerId: client.consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: oldKey.kid,
        }),
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId1,
        GSIPK_purposeId: purpose1.id,
      };
      const tokenConsumerClient2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK2),
        consumerId: client.consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: oldKey.kid,
        }),
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId2,
        GSIPK_purposeId: purpose2.id,
      };
      const tokenConsumerClient3: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK3),
        consumerId: client.consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: addedKey.kid,
        }),
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId3,
        GSIPK_purposeId: purpose1.id,
      };
      const tokenConsumerClient4: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK4),
        consumerId: client.consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: addedKey.kid,
        }),
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId4,
        GSIPK_purposeId: purpose2.id,
      };
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient1,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient2,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient3,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient4,
        dynamoDBClient
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        ...previousPlatformClientEntry,
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformClientEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenConsumerClient1,
          PK: makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            kid: addedKey.kid,
            purposeId: purpose1.id,
          }),
          GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
            consumerId,
            eserviceId: agreement1.eserviceId,
          }),
          agreementId: agreement1.id,
          agreementState: platformAgreementEntry1.state,
          producerId: agreement1.producerId,
          GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
            eserviceId: agreement1.eserviceId,
            descriptorId: descriptor1.id,
          }),
          descriptorState: previousDescriptorEntry1.state,
          descriptorAudience: previousDescriptorEntry1.descriptorAudience,
          descriptorVoucherLifespan:
            previousDescriptorEntry1.descriptorVoucherLifespan,
          GSIPK_purposeId: purpose1.id,
          purposeState: platformPurposeEntry1.state,
          purposeVersionId: platformPurposeEntry1.purposeVersionId,
          publicKey: addedKey.encodedPem,
          GSIPK_clientId_kid: makeGSIPKClientIdKid({
            clientId: client.id,
            kid: addedKey.kid,
          }),
          GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
            clientId: client.id,
            purposeId: purpose1.id,
          }),
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenConsumerClient2,
          PK: makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            kid: addedKey.kid,
            purposeId: purpose2.id,
          }),
          GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
            consumerId,
            eserviceId: agreement2.eserviceId,
          }),
          agreementId: agreement2.id,
          agreementState: platformAgreementEntry2.state,
          producerId: agreement2.producerId,
          GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
            eserviceId: agreement2.eserviceId,
            descriptorId: descriptor2.id,
          }),
          descriptorState: previousDescriptorEntry2.state,
          descriptorAudience: previousDescriptorEntry2.descriptorAudience,
          descriptorVoucherLifespan:
            previousDescriptorEntry2.descriptorVoucherLifespan,
          GSIPK_purposeId: purpose2.id,
          purposeState: platformPurposeEntry2.state,
          purposeVersionId: platformPurposeEntry2.purposeVersionId,
          publicKey: addedKey.encodedPem,
          GSIPK_clientId_kid: makeGSIPKClientIdKid({
            clientId: client.id,
            kid: addedKey.kid,
          }),
          GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
            clientId: client.id,
            purposeId: purpose2.id,
          }),
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(4);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenConsumerClient1,
          tokenConsumerClient2,
          expectedTokenConsumerClient1,
          expectedTokenConsumerClient2,
        ])
      );
    });

    it("should update platform-states entry and insert token-generation-states client-kid entry if the client does not contain purposes", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const oldKey = getMockKey();
      const addedKey = getMockKey();
      const client: Client = {
        ...getMockClient(),
        keys: [oldKey, addedKey],
      };

      const payload: KeysAddedV1 = {
        clientId: client.id,
        keys: [
          {
            keyId: generateId(),
            value: toKeyV1(addedKey),
          },
        ],
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "KeysAdded",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformClientPK = makePlatformStatesClientPK(client.id);
      const previousPlatformClientEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        version: previousPlatformEntryVersion,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [],
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: oldKey.kid,
      });
      const tokenClientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK),
        consumerId: client.consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: oldKey.kid,
        }),
      };
      await writeTokenGenStatesApiClient(
        tokenClientEntry,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        ...previousPlatformClientEntry,
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformClientEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenClientEntry: TokenGenerationStatesConsumerClient = {
        PK: makeTokenGenerationStatesClientKidPK({
          clientId: client.id,
          kid: addedKey.kid,
        }),
        consumerId: client.consumerId,
        clientKind: clientKindTokenGenStates.consumer,
        publicKey: addedKey.encodedPem,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: addedKey.kid,
        }),
        updatedAt: new Date().toISOString(),
      };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([tokenClientEntry, expectedTokenClientEntry])
      );
    });

    it("should update platform-states entry and update token-generation-states client-kid entry", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const oldKey = getMockKey();
      const addedKey = getMockKey();
      const client: Client = {
        ...getMockClient(),
        keys: [oldKey, addedKey],
      };

      const payload: KeysAddedV1 = {
        clientId: client.id,
        keys: [
          {
            keyId: generateId(),
            value: toKeyV1(addedKey),
          },
        ],
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "KeysAdded",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformClientPK = makePlatformStatesClientPK(client.id);
      const previousPlatformClientEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        version: previousPlatformEntryVersion,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [],
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenClientKidPK1 = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: oldKey.kid,
      });
      const tokenClientKidPK2 = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: addedKey.kid,
      });
      const tokenClientEntry1: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK1),
        consumerId: client.consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: oldKey.kid,
        }),
      };
      const tokenClientEntry2: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK2),
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: addedKey.kid,
        }),
      };
      await writeTokenGenStatesApiClient(
        tokenClientEntry1,
        dynamoDBClient,
        genericLogger
      );
      await writeTokenGenStatesApiClient(
        tokenClientEntry2,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        ...previousPlatformClientEntry,
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformClientEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenClientEntry: TokenGenerationStatesConsumerClient = {
        PK: makeTokenGenerationStatesClientKidPK({
          clientId: client.id,
          kid: addedKey.kid,
        }),
        consumerId: client.consumerId,
        clientKind: clientKindTokenGenStates.consumer,
        publicKey: addedKey.encodedPem,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: addedKey.kid,
        }),
        updatedAt: new Date().toISOString(),
      };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([tokenClientEntry1, expectedTokenClientEntry])
      );
    });
  });

  describe("KeyDeleted", () => {
    it("should do no operation if the existing table entry is more recent", async () => {
      const previousPlatformEntryVersion = 2;
      const messageVersion = 1;

      const purposeId = generateId<PurposeId>();
      const client: Client = {
        ...getMockClient(),
        purposes: [purposeId],
      };
      const kidToRemove = "removed kid";

      const payload: KeyDeletedV1 = {
        clientId: client.id,
        keyId: kidToRemove,
        deactivationTimestamp: new Date().toISOString(),
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "KeyDeleted",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformClientPK = makePlatformStatesClientPK(client.id);
      const previousPlatformClientEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        version: previousPlatformEntryVersion,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [],
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: kidToRemove,
      });
      const tokenClientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK),
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: kidToRemove,
        }),
      };
      await writeTokenGenStatesApiClient(
        tokenClientEntry,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toEqual(previousPlatformClientEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toEqual([tokenClientEntry]);
    });

    it("should insert platform-states entry and delete token-generation-states entries for that kid", async () => {
      const messageVersion = 2;

      const purposeId = generateId<PurposeId>();
      const client: Client = {
        ...getMockClient(),
        purposes: [purposeId],
      };
      const kidToRemove = "removed kid";

      const payload: KeyDeletedV1 = {
        clientId: client.id,
        keyId: kidToRemove,
        deactivationTimestamp: new Date().toISOString(),
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "KeyDeleted",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformClientPK = makePlatformStatesClientPK(client.id);
      expect(
        await readPlatformClientEntry(platformClientPK, dynamoDBClient)
      ).toBeUndefined();

      // token-generation-states
      const tokenClientKidPurposePK =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: kidToRemove,
          purposeId,
        });

      const tokenConsumerClientWithKid: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK),
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: kidToRemove,
        }),
        GSIPK_clientId: client.id,
      };
      const tokenConsumerClientWithOtherKid: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_clientId: client.id,
        };

      await writeTokenGenStatesConsumerClient(
        tokenConsumerClientWithKid,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClientWithOtherKid,
        dynamoDBClient
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformStatesEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformStatesEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenConsumerClientWithOtherKid,
          tokenConsumerClientWithKid,
        ])
      );
    });

    it("should update platform-states entry and delete token-generation-states entries for that kid", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const purposeId = generateId<PurposeId>();
      const client: Client = {
        ...getMockClient(),
        purposes: [purposeId],
      };
      const kidToRemove = "removed kid";
      const otherKid = "other kid";

      const payload: KeyDeletedV1 = {
        clientId: client.id,
        keyId: kidToRemove,
        deactivationTimestamp: new Date().toISOString(),
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "KeyDeleted",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformClientPK = makePlatformStatesClientPK(client.id);
      const previousPlatformClientEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        version: previousPlatformEntryVersion,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [purposeId],
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenClientKidPurposePK =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: kidToRemove,
          purposeId,
        });
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: otherKid,
      });

      const tokenConsumerClientWithKid: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK),
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: kidToRemove,
        }),
        GSIPK_clientId: client.id,
      };

      const tokenClientEntryWithOtherKid: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK),
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: otherKid,
        }),
      };

      await writeTokenGenStatesConsumerClient(
        tokenConsumerClientWithKid,
        dynamoDBClient
      );
      await writeTokenGenStatesApiClient(
        tokenClientEntryWithOtherKid,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformStatesEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        ...previousPlatformClientEntry,
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformStatesEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toEqual([
        tokenClientEntryWithOtherKid,
      ]);
    });
  });

  describe("ClientPurposeAdded", () => {
    it("should do no operation if the existing table entry is more recent", async () => {
      const previousPlatformEntryVersion = 2;
      const messageVersion = 1;

      const purposeId = generateId<PurposeId>();
      const client: Client = {
        ...getMockClient(),
        purposes: [purposeId],
      };

      const payload: ClientPurposeAddedV1 = {
        clientId: client.id,
        statesChain: {
          id: generateId(),
          purpose: {
            purposeId,
            state: ClientComponentStateV1.ACTIVE,
            versionId: generateId(),
          },
        },
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientPurposeAdded",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformClientPK = makePlatformStatesClientPK(client.id);
      const previousPlatformClientEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        version: previousPlatformEntryVersion,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [],
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );
      // token-generation-states
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: "KID",
      });
      const tokenClientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK),
        GSIPK_clientId: client.id,
      };
      await writeTokenGenStatesApiClient(
        tokenClientEntry,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toEqual(previousPlatformClientEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toEqual([tokenClientEntry]);
    });

    it("should do no operation if the entry doesn't exist in platform-states", async () => {
      const messageVersion = 2;

      const purposeId = generateId<PurposeId>();
      const client: Client = {
        ...getMockClient(),
        purposes: [purposeId],
      };

      const payload: ClientPurposeAddedV1 = {
        clientId: client.id,
        statesChain: {
          id: generateId(),
          purpose: {
            purposeId,
            state: ClientComponentStateV1.ACTIVE,
            versionId: generateId(),
          },
        },
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientPurposeAdded",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformClientPK = makePlatformStatesClientPK(client.id);
      expect(
        await readPlatformClientEntry(platformClientPK, dynamoDBClient)
      ).toBeUndefined();

      // token-generation-states
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: "KID",
      });
      const tokenClientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK),
        GSIPK_clientId: client.id,
      };
      await writeTokenGenStatesApiClient(
        tokenClientEntry,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toEqual([tokenClientEntry]);
    });

    it("should update platform-states entry", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const purposeId = generateId<PurposeId>();
      const client: Client = {
        ...getMockClient(),
        purposes: [purposeId],
      };

      const payload: ClientPurposeAddedV1 = {
        clientId: client.id,
        statesChain: {
          id: generateId(),
          purpose: {
            purposeId,
            state: ClientComponentStateV1.ACTIVE,
            versionId: generateId(),
          },
        },
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientPurposeAdded",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformClientPK = makePlatformStatesClientPK(client.id);
      const previousPlatformClientEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        version: previousPlatformEntryVersion,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,

        updatedAt: new Date().toISOString(),
        clientPurposesIds: [],
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenConsumerClient: TokenGenerationStatesConsumerClient =
        getMockTokenGenStatesConsumerClient();
      const tokenClientEntry: TokenGenerationStatesApiClient =
        getMockTokenGenStatesApiClient();
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient,
        dynamoDBClient
      );
      await writeTokenGenStatesApiClient(
        tokenClientEntry,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformStatesEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        ...previousPlatformClientEntry,
        version: messageVersion,
        clientPurposesIds: [purposeId],
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformStatesEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([tokenConsumerClient, tokenClientEntry])
      );
    });

    it("should update platform-states entry and convert client-kid entries to client-kid-purpose entries in token-generation-states table", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const consumerId = generateId<TenantId>();
      const purpose: Purpose = {
        ...getMockPurpose(),
        consumerId,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const client: Client = {
        ...getMockClient(),
        consumerId,
        purposes: [purpose.id],
      };

      const payload: ClientPurposeAddedV1 = {
        clientId: client.id,
        statesChain: {
          id: generateId(),
          purpose: {
            purposeId: purpose.id,
            state: ClientComponentStateV1.ACTIVE,
            versionId: generateId(),
          },
        },
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientPurposeAdded",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformPurposeEntry: PlatformStatesPurposeEntry = {
        PK: makePlatformStatesPurposePK(purpose.id),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        purposeVersionId: purpose.versions[0].id,
        purposeEserviceId: purpose.eserviceId,
        purposeConsumerId: purpose.consumerId,
      };
      await writePlatformPurposeEntry(platformPurposeEntry, dynamoDBClient);

      const agreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId: purpose.eserviceId,
      };
      const platformAgreementEntry: PlatformStatesAgreementEntry = {
        PK: makePlatformStatesAgreementPK({
          consumerId,
          eserviceId: agreement.eserviceId,
        }),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        agreementId: agreement.id,
        agreementTimestamp: agreement.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement.descriptorId,
        producerId: agreement.producerId,
      };
      await writePlatformAgreementEntry(platformAgreementEntry, dynamoDBClient);

      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        id: agreement.descriptorId,
      };
      const previousDescriptorEntry: PlatformStatesCatalogEntry = {
        PK: makePlatformStatesEServiceDescriptorPK({
          eserviceId: purpose.eserviceId,
          descriptorId: descriptor.id,
        }),
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: descriptor.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousDescriptorEntry, dynamoDBClient);

      const platformClientPK = makePlatformStatesClientPK(client.id);
      const previousPlatformClientEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        version: previousPlatformEntryVersion,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [],
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const kid1 = "KID1";
      const kid2 = "KID2";
      const tokenClientKidPK1 = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: kid1,
      });
      const tokenClientKidPK2 = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: kid2,
      });

      const tokenClientEntry1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPK1),
        consumerId: client.consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: kid1,
        }),
      };
      const tokenClientEntry2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPK2),
        consumerId: client.consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: kid2,
        }),
      };
      const tokenConsumerClientWithOtherClient =
        getMockTokenGenStatesConsumerClient();

      await writeTokenGenStatesConsumerClient(
        tokenClientEntry1,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenClientEntry2,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClientWithOtherClient,
        dynamoDBClient
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformStatesEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        ...previousPlatformClientEntry,
        version: messageVersion,
        clientPurposesIds: [purpose.id],
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformStatesEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const newTokenConsumerClientData: Partial<TokenGenerationStatesConsumerClient> =
        {
          clientKind: clientKindTokenGenStates.consumer,
          GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
            clientId: client.id,
            purposeId: purpose.id,
          }),
          GSIPK_purposeId: purpose.id,
          purposeState: platformPurposeEntry.state,
          purposeVersionId: platformPurposeEntry.purposeVersionId,
          GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
            consumerId,
            eserviceId: agreement.eserviceId,
          }),
          agreementId: agreement.id,
          agreementState: platformAgreementEntry.state,
          producerId: agreement.producerId,
          GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
            eserviceId: agreement.eserviceId,
            descriptorId: descriptor.id,
          }),
          descriptorState: previousDescriptorEntry.state,
          descriptorAudience: previousDescriptorEntry.descriptorAudience,
          descriptorVoucherLifespan:
            previousDescriptorEntry.descriptorVoucherLifespan,
          updatedAt: new Date().toISOString(),
        };

      const expectedTokenConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenClientEntry1,
          ...newTokenConsumerClientData,
          PK: makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            purposeId: purpose.id,
            kid: kid1,
          }),
        };

      const expectedTokenConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenClientEntry2,
          ...newTokenConsumerClientData,
          PK: makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            purposeId: purpose.id,
            kid: kid2,
          }),
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(3);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenConsumerClientWithOtherClient,
          expectedTokenConsumerClient1,
          expectedTokenConsumerClient2,
        ])
      );
    });

    it("should update platform-states entry and add client-kid-purpose entries to token-generation-states table", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const consumerId = generateId<TenantId>();
      const purpose1: Purpose = {
        ...getMockPurpose(),
        consumerId,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const purpose2: Purpose = {
        ...getMockPurpose(),
        consumerId,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };

      const client: Client = {
        ...getMockClient(),
        consumerId,
        purposes: [purpose1.id, purpose2.id],
      };

      const payload: ClientPurposeAddedV1 = {
        clientId: client.id,
        statesChain: {
          id: generateId(),
          purpose: {
            purposeId: purpose2.id,
            state: ClientComponentStateV1.ACTIVE,
            versionId: generateId(),
          },
        },
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientPurposeAdded",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformPurposeEntry1: PlatformStatesPurposeEntry = {
        PK: makePlatformStatesPurposePK(purpose1.id),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        purposeVersionId: purpose1.versions[0].id,
        purposeEserviceId: purpose1.eserviceId,
        purposeConsumerId: purpose1.consumerId,
      };
      await writePlatformPurposeEntry(platformPurposeEntry1, dynamoDBClient);

      const platformPurposeEntry2: PlatformStatesPurposeEntry = {
        PK: makePlatformStatesPurposePK(purpose2.id),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        purposeVersionId: purpose2.versions[0].id,
        purposeEserviceId: purpose2.eserviceId,
        purposeConsumerId: purpose2.consumerId,
      };
      await writePlatformPurposeEntry(platformPurposeEntry2, dynamoDBClient);

      const agreement1: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId: purpose1.eserviceId,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const platformAgreementEntry1: PlatformStatesAgreementEntry = {
        PK: makePlatformStatesAgreementPK({
          consumerId,
          eserviceId: agreement1.eserviceId,
        }),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        agreementId: agreement1.id,
        agreementTimestamp: agreement1.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement1.descriptorId,
        producerId: agreement1.producerId,
      };
      await writePlatformAgreementEntry(
        platformAgreementEntry1,
        dynamoDBClient
      );

      const agreement2: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId: purpose2.eserviceId,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const platformAgreementEntry2: PlatformStatesAgreementEntry = {
        PK: makePlatformStatesAgreementPK({
          consumerId,
          eserviceId: agreement2.eserviceId,
        }),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        agreementId: agreement2.id,
        agreementTimestamp: agreement2.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement2.descriptorId,
        producerId: agreement2.producerId,
      };
      await writePlatformAgreementEntry(
        platformAgreementEntry2,
        dynamoDBClient
      );

      const descriptor1: Descriptor = {
        ...getMockDescriptor(),
        id: agreement1.descriptorId,
      };
      const previousDescriptorEntry1: PlatformStatesCatalogEntry = {
        PK: makePlatformStatesEServiceDescriptorPK({
          eserviceId: purpose1.eserviceId,
          descriptorId: descriptor1.id,
        }),
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: descriptor1.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousDescriptorEntry1, dynamoDBClient);

      const descriptor2: Descriptor = {
        ...getMockDescriptor(),
        id: agreement2.descriptorId,
      };
      const previousDescriptorEntry2: PlatformStatesCatalogEntry = {
        PK: makePlatformStatesEServiceDescriptorPK({
          eserviceId: purpose2.eserviceId,
          descriptorId: descriptor2.id,
        }),
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: descriptor2.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousDescriptorEntry2, dynamoDBClient);

      const platformClientPK = makePlatformStatesClientPK(client.id);
      const previousPlatformClientEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        version: previousPlatformEntryVersion,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [purpose1.id],
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const kid1 = "KID1";
      const kid2 = "KID2";
      const tokenClientKidPurposePK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: kid1,
          purposeId: purpose1.id,
        });
      const tokenClientKidPurposePK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: kid2,
          purposeId: purpose1.id,
        });

      const gsiPKClientIdPurposeId1 = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: purpose1.id,
      });
      const tokenConsumerClient1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK1),
        consumerId: client.consumerId,
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId1,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: kid1,
        }),
        GSIPK_purposeId: purpose1.id,
      };
      const tokenConsumerClient2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK2),
        consumerId: client.consumerId,
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId1,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: kid2,
        }),
        GSIPK_purposeId: purpose1.id,
      };
      const tokenClientEntryWithOtherClient = getMockTokenGenStatesApiClient();

      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient1,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient2,
        dynamoDBClient
      );
      await writeTokenGenStatesApiClient(
        tokenClientEntryWithOtherClient,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformStatesEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        ...previousPlatformClientEntry,
        version: messageVersion,
        clientPurposesIds: [purpose1.id, purpose2.id],
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformStatesEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const newTokenConsumerClientData: Partial<TokenGenerationStatesConsumerClient> =
        {
          GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
            clientId: client.id,
            purposeId: purpose2.id,
          }),
          GSIPK_purposeId: purpose2.id,
          purposeState: platformPurposeEntry2.state,
          purposeVersionId: platformPurposeEntry2.purposeVersionId,
          GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
            consumerId,
            eserviceId: agreement2.eserviceId,
          }),
          agreementId: agreement2.id,
          agreementState: platformAgreementEntry2.state,
          producerId: agreement2.producerId,
          GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
            eserviceId: purpose2.eserviceId,
            descriptorId: descriptor2.id,
          }),
          descriptorState: previousDescriptorEntry2.state,
          descriptorAudience: previousDescriptorEntry2.descriptorAudience,
          descriptorVoucherLifespan:
            previousDescriptorEntry2.descriptorVoucherLifespan,
          updatedAt: new Date().toISOString(),
        };

      const expectedTokenConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenConsumerClient1,
          ...newTokenConsumerClientData,
          PK: makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            purposeId: purpose2.id,
            kid: kid1,
          }),
        };

      const expectedTokenConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenConsumerClient2,
          ...newTokenConsumerClientData,
          PK: makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            purposeId: purpose2.id,
            kid: kid2,
          }),
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(5);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenClientEntryWithOtherClient,
          tokenConsumerClient1,
          tokenConsumerClient2,
          expectedTokenConsumerClient1,
          expectedTokenConsumerClient2,
        ])
      );
    });

    it("should update platform-states entry and update client-kid-purpose entries to token-generation-states table", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const consumerId = generateId<TenantId>();
      const purpose1: Purpose = {
        ...getMockPurpose(),
        consumerId,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const purpose2: Purpose = {
        ...getMockPurpose(),
        consumerId,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };

      const client: Client = {
        ...getMockClient(),
        consumerId,
        purposes: [purpose1.id, purpose2.id],
      };

      const payload: ClientPurposeAddedV1 = {
        clientId: client.id,
        statesChain: {
          id: generateId(),
          purpose: {
            purposeId: purpose2.id,
            state: ClientComponentStateV1.ACTIVE,
            versionId: generateId(),
          },
        },
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientPurposeAdded",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformPurposeEntry1: PlatformStatesPurposeEntry = {
        PK: makePlatformStatesPurposePK(purpose1.id),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        purposeVersionId: purpose1.versions[0].id,
        purposeEserviceId: purpose1.eserviceId,
        purposeConsumerId: purpose1.consumerId,
      };
      await writePlatformPurposeEntry(platformPurposeEntry1, dynamoDBClient);

      const platformPurposeEntry2: PlatformStatesPurposeEntry = {
        PK: makePlatformStatesPurposePK(purpose2.id),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        purposeVersionId: purpose2.versions[0].id,
        purposeEserviceId: purpose2.eserviceId,
        purposeConsumerId: purpose2.consumerId,
      };
      await writePlatformPurposeEntry(platformPurposeEntry2, dynamoDBClient);

      const agreement1: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId: purpose1.eserviceId,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const platformAgreementEntry1: PlatformStatesAgreementEntry = {
        PK: makePlatformStatesAgreementPK({
          consumerId,
          eserviceId: agreement1.eserviceId,
        }),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        agreementId: agreement1.id,
        agreementTimestamp: agreement1.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement1.descriptorId,
        producerId: agreement1.producerId,
      };
      await writePlatformAgreementEntry(
        platformAgreementEntry1,
        dynamoDBClient
      );

      const agreement2: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId: purpose2.eserviceId,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const platformAgreementEntry2: PlatformStatesAgreementEntry = {
        PK: makePlatformStatesAgreementPK({
          consumerId,
          eserviceId: agreement2.eserviceId,
        }),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        agreementId: agreement2.id,
        agreementTimestamp: agreement2.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement2.descriptorId,
        producerId: agreement2.producerId,
      };
      await writePlatformAgreementEntry(
        platformAgreementEntry2,
        dynamoDBClient
      );

      const descriptor1: Descriptor = {
        ...getMockDescriptor(),
        id: agreement1.descriptorId,
      };
      const previousDescriptorEntry1: PlatformStatesCatalogEntry = {
        PK: makePlatformStatesEServiceDescriptorPK({
          eserviceId: purpose1.eserviceId,
          descriptorId: descriptor1.id,
        }),
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: descriptor1.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousDescriptorEntry1, dynamoDBClient);

      const descriptor2: Descriptor = {
        ...getMockDescriptor(),
        id: agreement2.descriptorId,
      };
      const previousDescriptorEntry2: PlatformStatesCatalogEntry = {
        PK: makePlatformStatesEServiceDescriptorPK({
          eserviceId: purpose2.eserviceId,
          descriptorId: descriptor2.id,
        }),
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: descriptor2.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousDescriptorEntry2, dynamoDBClient);

      const platformClientPK = makePlatformStatesClientPK(client.id);
      const previousPlatformClientEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        version: previousPlatformEntryVersion,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [purpose1.id],
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const kid1 = "KID1";
      const kid2 = "KID2";
      const tokenClientKidPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: client.id,
        kid: kid1,
        purposeId: purpose1.id,
      });
      const tokenClientKidPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: client.id,
        kid: kid2,
        purposeId: purpose1.id,
      });
      const tokenClientKidPK3 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: client.id,
        kid: kid1,
        purposeId: purpose2.id,
      });
      const tokenClientKidPK4 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: client.id,
        kid: kid2,
        purposeId: purpose2.id,
      });

      const gsiPKClientIdPurposeId1 = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: purpose1.id,
      });
      const gsiPKClientIdPurposeId2 = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: purpose2.id,
      });
      const tokenConsumerClient1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPK1),
        consumerId: client.consumerId,
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId1,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: kid1,
        }),
        GSIPK_purposeId: purpose1.id,
      };
      const tokenConsumerClient2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPK2),
        consumerId: client.consumerId,
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId1,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: kid2,
        }),
        GSIPK_purposeId: purpose1.id,
      };
      const tokenConsumerClient3: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPK3),
        consumerId: client.consumerId,
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId2,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: kid1,
        }),
        GSIPK_purposeId: purpose2.id,
      };
      const tokenConsumerClient4: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPK4),
        consumerId: client.consumerId,
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId2,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: kid2,
        }),
        GSIPK_purposeId: purpose2.id,
      };
      const tokenClientEntryWithOtherClient = getMockTokenGenStatesApiClient();

      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient1,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient2,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient3,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient4,
        dynamoDBClient
      );
      await writeTokenGenStatesApiClient(
        tokenClientEntryWithOtherClient,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformStatesEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        ...previousPlatformClientEntry,
        version: messageVersion,
        clientPurposesIds: [purpose1.id, purpose2.id],
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformStatesEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const newTokenConsumerClientData: Partial<TokenGenerationStatesConsumerClient> =
        {
          GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
            clientId: client.id,
            purposeId: purpose2.id,
          }),
          GSIPK_purposeId: purpose2.id,
          purposeState: platformPurposeEntry2.state,
          purposeVersionId: platformPurposeEntry2.purposeVersionId,
          GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
            consumerId,
            eserviceId: agreement2.eserviceId,
          }),
          agreementId: agreement2.id,
          agreementState: platformAgreementEntry2.state,
          producerId: agreement2.producerId,
          GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
            eserviceId: agreement2.eserviceId,
            descriptorId: descriptor2.id,
          }),
          descriptorState: previousDescriptorEntry2.state,
          descriptorAudience: previousDescriptorEntry2.descriptorAudience,
          descriptorVoucherLifespan:
            previousDescriptorEntry2.descriptorVoucherLifespan,
          updatedAt: new Date().toISOString(),
        };

      const expectedTokenConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenConsumerClient3,
          ...newTokenConsumerClientData,
        };
      const expectedTokenConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenConsumerClient4,
          ...newTokenConsumerClientData,
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(5);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenClientEntryWithOtherClient,
          tokenConsumerClient1,
          tokenConsumerClient2,
          expectedTokenConsumerClient1,
          expectedTokenConsumerClient2,
        ])
      );
    });
  });

  describe("ClientPurposeRemoved", () => {
    it("should do no operation if the existing table entry is more recent", async () => {
      const previousPlatformEntryVersion = 2;
      const messageVersion = 1;

      const purposeId = generateId<PurposeId>();
      const client: Client = {
        ...getMockClient(),
        purposes: [purposeId],
      };

      const payload: ClientPurposeRemovedV1 = {
        purposeId,
        clientId: client.id,
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientPurposeRemoved",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformClientPK = makePlatformStatesClientPK(client.id);
      const previousPlatformClientEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        version: previousPlatformEntryVersion,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [],
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: "KID",
      });
      const tokenClientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK),
        GSIPK_clientId: client.id,
      };
      await writeTokenGenStatesApiClient(
        tokenClientEntry,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toEqual(previousPlatformClientEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toEqual([tokenClientEntry]);
    });

    it("should do no operation if the purpose platform-states entry doesn't exist and the token-generation-states entries aren't associated to the purpose id in the message", async () => {
      const messageVersion = 1;

      const purposeId = generateId<PurposeId>();
      const client: Client = {
        ...getMockClient(),
        purposes: [purposeId],
      };

      const payload: ClientPurposeRemovedV1 = {
        purposeId,
        clientId: client.id,
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientPurposeRemoved",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformClientPK = makePlatformStatesClientPK(client.id);
      expect(
        await readPlatformClientEntry(platformClientPK, dynamoDBClient)
      ).toBeUndefined();

      // token-generation-states
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: "KID",
      });
      const tokenClientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK),
        GSIPK_clientId: client.id,
      };
      await writeTokenGenStatesApiClient(
        tokenClientEntry,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toEqual([tokenClientEntry]);
    });

    it("should update platform-states entry and delete token-generation-states entries for that purpose", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const purposeId1 = generateId<PurposeId>();
      const purposeId2 = generateId<PurposeId>();
      const client: Client = {
        ...getMockClient(),
        purposes: [purposeId1],
      };

      const payload: ClientPurposeRemovedV1 = {
        purposeId: purposeId2,
        clientId: client.id,
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientPurposeRemoved",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformClientPK = makePlatformStatesClientPK(client.id);
      const previousPlatformClientEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        version: previousPlatformEntryVersion,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [purposeId1, purposeId2],
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const kid1 = "kid1";
      const kid2 = "kid2";
      const tokenClientKidPurposePK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: kid1,
          purposeId: purposeId1,
        });
      const tokenClientKidPurposePK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: kid2,
          purposeId: purposeId2,
        });
      const gsiPKClientIdPurposeId1 = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: purposeId1,
      });
      const gsiPKClientIdPurposeId2 = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: purposeId2,
      });

      const tokenClientEntry = getMockTokenGenStatesApiClient();

      const tokenConsumerClient1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK1),
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId1,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: kid1,
        }),
        GSIPK_purposeId: purposeId1,
      };

      const tokenConsumerClient2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK2),
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId2,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: kid2,
        }),
        GSIPK_purposeId: purposeId2,
      };

      await writeTokenGenStatesApiClient(
        tokenClientEntry,
        dynamoDBClient,
        genericLogger
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient1,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformStatesEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        ...previousPlatformClientEntry,
        clientPurposesIds: [purposeId1],
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformStatesEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([tokenClientEntry, tokenConsumerClient1])
      );
    });
  });

  describe("ClientDeleted", () => {
    it("should delete platform-states entry and token-generation-states entries", async () => {
      const messageVersion = 2;

      const purposeId = generateId<PurposeId>();
      const client = getMockClient();

      const payload: ClientDeletedV1 = {
        clientId: client.id,
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientDeleted",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      const otherClientId = generateId<ClientId>();

      // platform-states
      const pk1PlatformStates = makePlatformStatesClientPK(client.id);
      const clientPlatformStateEntry1: PlatformStatesClientEntry = {
        PK: pk1PlatformStates,
        version: 1,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [],
      };

      const pk2PlatformStates = makePlatformStatesClientPK(otherClientId);
      const clientPlatformStateEntry2: PlatformStatesClientEntry = {
        PK: pk2PlatformStates,
        version: 1,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [],
      };
      await writePlatformClientEntry(
        clientPlatformStateEntry1,
        dynamoDBClient,
        genericLogger
      );
      await writePlatformClientEntry(
        clientPlatformStateEntry2,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const pkTokenGenStates1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: client.id,
        kid: "kid",
        purposeId,
      });

      const pkTokenGenStates2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: otherClientId,
        kid: "kid",
        purposeId,
      });

      const clientPurposeTokenGenStatesEntry: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(pkTokenGenStates1),
          GSIPK_clientId: client.id,
        };

      const otherClientPurposeTokenGenStatesEntry: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(pkTokenGenStates2),
          GSIPK_clientId: otherClientId,
        };

      await writeTokenGenStatesConsumerClient(
        clientPurposeTokenGenStatesEntry,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        otherClientPurposeTokenGenStatesEntry,
        dynamoDBClient
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformStatesEntries =
        await readAllPlatformStatesItems(dynamoDBClient);
      expect(retrievedPlatformStatesEntries).toEqual([
        clientPlatformStateEntry2,
      ]);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toEqual([
        otherClientPurposeTokenGenStatesEntry,
      ]);
    });
  });
});
