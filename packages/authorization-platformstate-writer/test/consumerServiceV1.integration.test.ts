/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
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
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockClient,
  getMockTokenStatesClientEntry,
  getMockTokenStatesClientPurposeEntry,
  readAllPlatformStateItems,
  readAllTokenStateItems,
  getMockPurpose,
  getMockPurposeVersion,
  writePlatformPurposeEntry,
  getMockAgreement,
  writePlatformAgreementEntry,
  getMockDescriptor,
  writeCatalogEntry,
} from "pagopa-interop-commons-test";
import {
  AuthorizationEventEnvelope,
  Client,
  ClientComponentStateV1,
  ClientDeletedV1,
  ClientId,
  clientKindTokenStates,
  ClientPurposeAddedV1,
  ClientPurposeRemovedV1,
  Descriptor,
  generateId,
  itemState,
  KeyDeletedV1,
  makeGSIPKClientIdPurposeId,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makeGSIPKKid,
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
  TokenGenerationStatesClientEntry,
  TokenGenerationStatesClientPurposeEntry,
  unsafeBrandId,
} from "pagopa-interop-models";
import { handleMessageV1 } from "../src/consumerServiceV1.js";
import {
  clientKindToTokenGenerationStatesClientKind,
  readClientEntry,
  writeClientEntry,
  writeTokenStateClientEntry,
  writeTokenStateClientPurposeEntry,
} from "../src/utils.js";
import { config } from "./utils.js";

describe("integration tests V1 events", async () => {
  if (!config) {
    fail();
  }
  const dynamoDBClient = new DynamoDBClient({
    endpoint: `http://localhost:${config.tokenGenerationReadModelDbPort}`,
  });
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
    it("sample", () => {
      expect(1).toBe(1);
    });
  });

  // eslint-disable-next-line sonarjs/no-identical-functions
  describe("KeysAdded", () => {
    it("sample", () => {
      expect(1).toBe(1);
    });
  });

  describe("KeyDeleted", () => {
    it("should delete entries in token-generation-states for that kid", async () => {
      const clientId = generateId<ClientId>();
      const purposeId = generateId<PurposeId>();

      const kidToRemove = "removed kid";

      const payload: KeyDeletedV1 = {
        keyId: kidToRemove,
        clientId,
        deactivationTimestamp: new Date().toISOString(),
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: clientId,
        version: 1,
        type: "KeyDeleted",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      const pk1PlatformStates = makePlatformStatesClientPK(clientId);
      const clientPlatformStateEntry: PlatformStatesClientEntry = {
        PK: pk1PlatformStates,
        version: 1,
        state: itemState.active,
        clientKind: clientKindTokenStates.consumer,
        clientConsumerId: generateId<TenantId>(),
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [],
      };

      await writeClientEntry(clientPlatformStateEntry, dynamoDBClient);

      const GSIPK_clientId = clientId;
      const pk1 = makeTokenGenerationStatesClientKidPK({
        clientId,
        kid: kidToRemove,
      });
      const pk2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId,
        kid: kidToRemove,
        purposeId,
      });
      const pk3 = makeTokenGenerationStatesClientKidPK({
        clientId,
        kid: "other kid",
      });

      const clientEntryWithKid: TokenGenerationStatesClientEntry = {
        PK: pk1,
        consumerId: generateId(),
        updatedAt: new Date().toISOString(),
        clientKind: clientKindTokenStates.consumer,
        publicKey: "PEM",
        GSIPK_clientId: unsafeBrandId(GSIPK_clientId),
        GSIPK_kid: makeGSIPKKid(kidToRemove),
      };

      const clientPurposeEntryWithKid: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(),
          PK: pk2,
          GSIPK_kid: makeGSIPKKid(kidToRemove),
          GSIPK_clientId: unsafeBrandId(GSIPK_clientId),
        };

      const clientEntryWithOtherKid: TokenGenerationStatesClientEntry = {
        PK: pk3,
        consumerId: generateId(),
        updatedAt: new Date().toISOString(),
        clientKind: clientKindTokenStates.consumer,
        publicKey: "PEM",
        GSIPK_clientId: unsafeBrandId(GSIPK_clientId),
        GSIPK_kid: makeGSIPKKid("other kid"),
      };

      await writeTokenStateClientEntry(clientEntryWithKid, dynamoDBClient);
      await writeTokenStateClientPurposeEntry(
        clientPurposeEntryWithKid,
        dynamoDBClient
      );
      await writeTokenStateClientEntry(clientEntryWithOtherKid, dynamoDBClient);

      await handleMessageV1(message, dynamoDBClient);

      const retrievedEntries = await readAllTokenStateItems(dynamoDBClient);

      expect(retrievedEntries).toEqual([clientEntryWithOtherKid]);
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
      await writeClientEntry(previousPlatformClientEntry, dynamoDBClient);
      // token-generation-states
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: "KID",
      });
      const tokenClientEntry: TokenGenerationStatesClientEntry = {
        ...getMockTokenStatesClientEntry(tokenClientKidPK),
        GSIPK_clientId: client.id,
      };
      await writeTokenStateClientEntry(tokenClientEntry, dynamoDBClient);

      await handleMessageV1(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformClientEntry = await readClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toEqual(previousPlatformClientEntry);

      // token-generation-states
      const retrievedTokenEntries = await readAllTokenStateItems(
        dynamoDBClient
      );
      expect(retrievedTokenEntries).toEqual([tokenClientEntry]);
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
        await readClientEntry(platformClientPK, dynamoDBClient)
      ).toBeUndefined();

      // token-generation-states
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: "KID",
      });
      const tokenClientEntry: TokenGenerationStatesClientEntry = {
        ...getMockTokenStatesClientEntry(tokenClientKidPK),
        GSIPK_clientId: client.id,
      };
      await writeTokenStateClientEntry(tokenClientEntry, dynamoDBClient);

      await handleMessageV1(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformClientEntry = await readClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenEntries = await readAllTokenStateItems(
        dynamoDBClient
      );
      expect(retrievedTokenEntries).toEqual([tokenClientEntry]);
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
      await writeClientEntry(previousPlatformClientEntry, dynamoDBClient);

      // token-generation-states
      const tokenClientPurposeEntry: TokenGenerationStatesClientPurposeEntry =
        getMockTokenStatesClientPurposeEntry();
      const tokenClientEntry: TokenGenerationStatesClientEntry =
        getMockTokenStatesClientEntry();
      await writeTokenStateClientPurposeEntry(
        tokenClientPurposeEntry,
        dynamoDBClient
      );
      await writeTokenStateClientEntry(tokenClientEntry, dynamoDBClient);

      await handleMessageV1(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformStatesEntry = await readClientEntry(
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
      const retrievedTokenEntries = await readAllTokenStateItems(
        dynamoDBClient
      );

      expect(retrievedTokenEntries).toHaveLength(2);
      expect(retrievedTokenEntries).toEqual(
        expect.arrayContaining([tokenClientPurposeEntry, tokenClientEntry])
      );
    });

    it("should update platform-states entry and convert client-kid entries to client-kid-purpose entries in token-generation-states table", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const client: Client = {
        ...getMockClient(),
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

      const agreement = getMockAgreement();
      const platformAgreementEntry: PlatformStatesAgreementEntry = {
        PK: makePlatformStatesAgreementPK(agreement.id),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
          consumerId: purpose.consumerId,
          eserviceId: purpose.eserviceId,
        }),
        GSISK_agreementTimestamp: new Date().toISOString(),
        agreementDescriptorId: agreement.descriptorId,
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
      await writeCatalogEntry(previousDescriptorEntry, dynamoDBClient);

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
      await writeClientEntry(previousPlatformClientEntry, dynamoDBClient);

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

      const tokenClientEntry1: TokenGenerationStatesClientEntry = {
        ...getMockTokenStatesClientEntry(tokenClientKidPK1),
        GSIPK_clientId: client.id,
        GSIPK_kid: makeGSIPKKid(kid1),
      };
      const tokenClientEntry2: TokenGenerationStatesClientEntry = {
        ...getMockTokenStatesClientEntry(tokenClientKidPK2),
        GSIPK_clientId: client.id,
        GSIPK_kid: makeGSIPKKid(kid2),
      };
      const tokenClientPurposeEntryWithOtherClient =
        getMockTokenStatesClientPurposeEntry();

      await writeTokenStateClientEntry(tokenClientEntry1, dynamoDBClient);
      await writeTokenStateClientEntry(tokenClientEntry2, dynamoDBClient);
      await writeTokenStateClientPurposeEntry(
        tokenClientPurposeEntryWithOtherClient,
        dynamoDBClient
      );

      await handleMessageV1(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformStatesEntry = await readClientEntry(
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
      const retrievedTokenEntries = await readAllTokenStateItems(
        dynamoDBClient
      );
      const newTokenClientPurposeEntryData = {
        GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
          clientId: client.id,
          purposeId: purpose.id,
        }),
        GSIPK_purposeId: purpose.id,
        purposeState: platformPurposeEntry.state,
        purposeVersionId: platformPurposeEntry.purposeVersionId,
        GSIPK_consumerId_eserviceId:
          platformAgreementEntry.GSIPK_consumerId_eserviceId,
        agreementId: agreement.id,
        agreementState: platformAgreementEntry.state,
        GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
          eserviceId: purpose.eserviceId,
          descriptorId: descriptor.id,
        }),
        descriptorState: previousDescriptorEntry.state,
        descriptorAudience: previousDescriptorEntry.descriptorAudience,
        descriptorVoucherLifespan:
          previousDescriptorEntry.descriptorVoucherLifespan,
        updatedAt: new Date().toISOString(),
      };

      const expectedTokenClientPurposeEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...tokenClientEntry1,
          ...newTokenClientPurposeEntryData,
          PK: makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            purposeId: purpose.id,
            kid: kid1,
          }),
        };

      const expectedTokenClientPurposeEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...tokenClientEntry2,
          ...newTokenClientPurposeEntryData,
          PK: makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            purposeId: purpose.id,
            kid: kid2,
          }),
        };

      expect(retrievedTokenEntries).toHaveLength(3);
      expect(retrievedTokenEntries).toEqual(
        expect.arrayContaining([
          tokenClientPurposeEntryWithOtherClient,
          expectedTokenClientPurposeEntry1,
          expectedTokenClientPurposeEntry2,
        ])
      );
    });

    it("should update platform-states entry and add client-kid-purpose entries to token-generation-states table", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const purpose1: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const purpose2: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };

      const client: Client = {
        ...getMockClient(),
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

      const agreement1 = getMockAgreement();
      const platformAgreementEntry1: PlatformStatesAgreementEntry = {
        PK: makePlatformStatesAgreementPK(agreement1.id),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
          consumerId: purpose1.consumerId,
          eserviceId: purpose1.eserviceId,
        }),
        GSISK_agreementTimestamp: new Date().toISOString(),
        agreementDescriptorId: agreement1.descriptorId,
      };
      await writePlatformAgreementEntry(
        platformAgreementEntry1,
        dynamoDBClient
      );

      const agreement2 = getMockAgreement();
      const platformAgreementEntry2: PlatformStatesAgreementEntry = {
        PK: makePlatformStatesAgreementPK(agreement2.id),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
          consumerId: purpose2.consumerId,
          eserviceId: purpose2.eserviceId,
        }),
        GSISK_agreementTimestamp: new Date().toISOString(),
        agreementDescriptorId: agreement2.descriptorId,
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
      await writeCatalogEntry(previousDescriptorEntry1, dynamoDBClient);

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
      await writeCatalogEntry(previousDescriptorEntry2, dynamoDBClient);

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
      await writeClientEntry(previousPlatformClientEntry, dynamoDBClient);

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
      const tokenClientPurposeEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenClientKidPurposePK1),
          consumerId: client.consumerId,
          GSIPK_clientId_purposeId: gsiPKClientIdPurposeId1,
          GSIPK_clientId: client.id,
          GSIPK_kid: makeGSIPKKid(kid1),
          GSIPK_purposeId: purpose1.id,
        };
      const tokenClientPurposeEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenClientKidPurposePK2),
          consumerId: client.consumerId,
          GSIPK_clientId_purposeId: gsiPKClientIdPurposeId1,
          GSIPK_clientId: client.id,
          GSIPK_kid: makeGSIPKKid(kid2),
          GSIPK_purposeId: purpose1.id,
        };
      const tokenClientEntryWithOtherClient = getMockTokenStatesClientEntry();

      await writeTokenStateClientPurposeEntry(
        tokenClientPurposeEntry1,
        dynamoDBClient
      );
      await writeTokenStateClientPurposeEntry(
        tokenClientPurposeEntry2,
        dynamoDBClient
      );
      await writeTokenStateClientEntry(
        tokenClientEntryWithOtherClient,
        dynamoDBClient
      );

      await handleMessageV1(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformStatesEntry = await readClientEntry(
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
      const retrievedTokenEntries = await readAllTokenStateItems(
        dynamoDBClient
      );
      const newTokenClientPurposeEntryData = {
        GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
          clientId: client.id,
          purposeId: purpose2.id,
        }),
        GSIPK_purposeId: purpose2.id,
        purposeState: platformPurposeEntry2.state,
        purposeVersionId: platformPurposeEntry2.purposeVersionId,
        GSIPK_consumerId_eserviceId:
          platformAgreementEntry2.GSIPK_consumerId_eserviceId,
        agreementId: agreement2.id,
        agreementState: platformAgreementEntry2.state,
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

      const expectedTokenClientPurposeEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...tokenClientPurposeEntry1,
          ...newTokenClientPurposeEntryData,
          PK: makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            purposeId: purpose2.id,
            kid: kid1,
          }),
        };

      const expectedTokenClientPurposeEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...tokenClientPurposeEntry2,
          ...newTokenClientPurposeEntryData,
          PK: makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            purposeId: purpose2.id,
            kid: kid2,
          }),
        };

      expect(retrievedTokenEntries).toHaveLength(5);
      expect(retrievedTokenEntries).toEqual(
        expect.arrayContaining([
          tokenClientEntryWithOtherClient,
          tokenClientPurposeEntry1,
          tokenClientPurposeEntry2,
          expectedTokenClientPurposeEntry1,
          expectedTokenClientPurposeEntry2,
        ])
      );
    });

    it("should update platform-states entry and update client-kid-purpose entries to token-generation-states table", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const purpose1: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const purpose2: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };

      const client: Client = {
        ...getMockClient(),
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

      const agreement1 = getMockAgreement();
      const platformAgreementEntry1: PlatformStatesAgreementEntry = {
        PK: makePlatformStatesAgreementPK(agreement1.id),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
          consumerId: purpose1.consumerId,
          eserviceId: purpose1.eserviceId,
        }),
        GSISK_agreementTimestamp: new Date().toISOString(),
        agreementDescriptorId: agreement1.descriptorId,
      };
      await writePlatformAgreementEntry(
        platformAgreementEntry1,
        dynamoDBClient
      );

      const agreement2 = getMockAgreement();
      const platformAgreementEntry2: PlatformStatesAgreementEntry = {
        PK: makePlatformStatesAgreementPK(agreement2.id),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
          consumerId: purpose2.consumerId,
          eserviceId: purpose2.eserviceId,
        }),
        GSISK_agreementTimestamp: new Date().toISOString(),
        agreementDescriptorId: agreement2.descriptorId,
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
      await writeCatalogEntry(previousDescriptorEntry1, dynamoDBClient);

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
      await writeCatalogEntry(previousDescriptorEntry2, dynamoDBClient);

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
      await writeClientEntry(previousPlatformClientEntry, dynamoDBClient);

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
      const tokenClientPurposeEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenClientKidPK1),
          consumerId: client.consumerId,
          GSIPK_clientId_purposeId: gsiPKClientIdPurposeId1,
          GSIPK_clientId: client.id,
          GSIPK_kid: makeGSIPKKid(kid1),
          GSIPK_purposeId: purpose1.id,
        };
      const tokenClientPurposeEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenClientKidPK2),
          consumerId: client.consumerId,
          GSIPK_clientId_purposeId: gsiPKClientIdPurposeId1,
          GSIPK_clientId: client.id,
          GSIPK_kid: makeGSIPKKid(kid2),
          GSIPK_purposeId: purpose1.id,
        };
      const tokenClientPurposeEntry3: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenClientKidPK3),
          consumerId: client.consumerId,
          GSIPK_clientId_purposeId: gsiPKClientIdPurposeId2,
          GSIPK_clientId: client.id,
          GSIPK_kid: makeGSIPKKid(kid1),
          GSIPK_purposeId: purpose2.id,
        };
      const tokenClientPurposeEntry4: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenClientKidPK4),
          consumerId: client.consumerId,
          GSIPK_clientId_purposeId: gsiPKClientIdPurposeId2,
          GSIPK_clientId: client.id,
          GSIPK_kid: makeGSIPKKid(kid2),
          GSIPK_purposeId: purpose2.id,
        };
      const tokenClientEntryWithOtherClient = getMockTokenStatesClientEntry();

      await writeTokenStateClientPurposeEntry(
        tokenClientPurposeEntry1,
        dynamoDBClient
      );
      await writeTokenStateClientPurposeEntry(
        tokenClientPurposeEntry2,
        dynamoDBClient
      );
      await writeTokenStateClientPurposeEntry(
        tokenClientPurposeEntry3,
        dynamoDBClient
      );
      await writeTokenStateClientPurposeEntry(
        tokenClientPurposeEntry4,
        dynamoDBClient
      );
      await writeTokenStateClientEntry(
        tokenClientEntryWithOtherClient,
        dynamoDBClient
      );

      await handleMessageV1(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformStatesEntry = await readClientEntry(
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
      const retrievedTokenEntries = await readAllTokenStateItems(
        dynamoDBClient
      );
      const newTokenClientPurposeEntryData = {
        GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
          clientId: client.id,
          purposeId: purpose2.id,
        }),
        GSIPK_purposeId: purpose2.id,
        purposeState: platformPurposeEntry2.state,
        purposeVersionId: platformPurposeEntry2.purposeVersionId,
        GSIPK_consumerId_eserviceId:
          platformAgreementEntry2.GSIPK_consumerId_eserviceId,
        agreementId: agreement2.id,
        agreementState: platformAgreementEntry2.state,
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

      const expectedTokenClientPurposeEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...tokenClientPurposeEntry1,
          ...newTokenClientPurposeEntryData,
          PK: makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            purposeId: purpose2.id,
            kid: kid1,
          }),
        };
      const expectedTokenClientPurposeEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...tokenClientPurposeEntry2,
          ...newTokenClientPurposeEntryData,
          PK: makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            purposeId: purpose2.id,
            kid: kid2,
          }),
        };

      expect(retrievedTokenEntries).toHaveLength(5);
      expect(retrievedTokenEntries).toEqual(
        expect.arrayContaining([
          tokenClientEntryWithOtherClient,
          tokenClientPurposeEntry1,
          tokenClientPurposeEntry2,
          expectedTokenClientPurposeEntry1,
          expectedTokenClientPurposeEntry2,
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
      await writeClientEntry(previousPlatformClientEntry, dynamoDBClient);

      // token-generation-states
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: "KID",
      });
      const tokenClientEntry: TokenGenerationStatesClientEntry = {
        ...getMockTokenStatesClientEntry(tokenClientKidPK),
        GSIPK_clientId: client.id,
      };
      await writeTokenStateClientEntry(tokenClientEntry, dynamoDBClient);

      await handleMessageV1(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformClientEntry = await readClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toEqual(previousPlatformClientEntry);

      // token-generation-states
      const retrievedTokenEntries = await readAllTokenStateItems(
        dynamoDBClient
      );
      expect(retrievedTokenEntries).toEqual([tokenClientEntry]);
    });

    it("should do no operation if the existing table entry doesn't exist", async () => {
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
        await readClientEntry(platformClientPK, dynamoDBClient)
      ).toBeUndefined();

      // token-generation-states
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: "KID",
      });

      const tokenClientEntry: TokenGenerationStatesClientEntry = {
        ...getMockTokenStatesClientEntry(tokenClientKidPK),
        GSIPK_clientId: client.id,
      };
      await writeTokenStateClientEntry(tokenClientEntry, dynamoDBClient);

      await handleMessageV1(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformClientEntry = await readClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenEntries = await readAllTokenStateItems(
        dynamoDBClient
      );
      expect(retrievedTokenEntries).toEqual([tokenClientEntry]);
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
      await writeClientEntry(previousPlatformClientEntry, dynamoDBClient);

      // token-generation-states
      const mockClientKidPurpose1 = "mockClientKidPurpose1";
      const mockClientKidPurpose2 = "mockClientKidPurpose2";
      const tokenClientKidPurposePK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: mockClientKidPurpose1,
          purposeId: purposeId1,
        });
      const tokenClientKidPurposePK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: mockClientKidPurpose2,
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

      const tokenClientEntry = getMockTokenStatesClientEntry();

      const tokenClientPurposeEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenClientKidPurposePK1),
          GSIPK_clientId_purposeId: gsiPKClientIdPurposeId1,
          GSIPK_clientId: client.id,
          GSIPK_kid: makeGSIPKKid(mockClientKidPurpose1),
          GSIPK_purposeId: purposeId1,
        };

      const tokenClientPurposeEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenClientKidPurposePK2),
          GSIPK_clientId_purposeId: gsiPKClientIdPurposeId2,
          GSIPK_clientId: client.id,
          GSIPK_kid: makeGSIPKKid(mockClientKidPurpose2),
          GSIPK_purposeId: purposeId2,
        };

      await writeTokenStateClientEntry(tokenClientEntry, dynamoDBClient);
      await writeTokenStateClientPurposeEntry(
        tokenClientPurposeEntry1,
        dynamoDBClient
      );
      await writeTokenStateClientPurposeEntry(
        tokenClientPurposeEntry2,
        dynamoDBClient
      );

      await handleMessageV1(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformStatesEntry = await readClientEntry(
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
      const retrievedTokenEntries = await readAllTokenStateItems(
        dynamoDBClient
      );
      expect(retrievedTokenEntries).toHaveLength(2);
      expect(retrievedTokenEntries).toEqual(
        expect.arrayContaining([tokenClientEntry, tokenClientPurposeEntry1])
      );
    });

    it("should delete platform-states entry and delete token-generation-states entries for that purpose", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const purposeId = generateId<PurposeId>();
      const client: Client = {
        ...getMockClient(),
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
        clientPurposesIds: [purposeId],
      };
      await writeClientEntry(previousPlatformClientEntry, dynamoDBClient);

      // token-generation-states
      const mockClientKidPurpose = "mockClientKidPurpose";
      const tokenClientKidPurposePK =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: mockClientKidPurpose,
          purposeId,
        });
      const gsiPKClientIdPurposeId = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId,
      });

      const tokenClientEntry = getMockTokenStatesClientEntry();

      const tokenClientPurposeEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenClientKidPurposePK),
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId,
        GSIPK_kid: makeGSIPKKid(mockClientKidPurpose),
        GSIPK_clientId: client.id,
        GSIPK_purposeId: purposeId,
      };

      await writeTokenStateClientEntry(tokenClientEntry, dynamoDBClient);
      await writeTokenStateClientPurposeEntry(
        tokenClientPurposeEntry,
        dynamoDBClient
      );

      await handleMessageV1(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformStatesEntry = await readClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformStatesEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenEntries = await readAllTokenStateItems(
        dynamoDBClient
      );
      const expectedTokenClientEntry: TokenGenerationStatesClientEntry = {
        PK: makeTokenGenerationStatesClientKidPK({
          clientId: client.id,
          kid: mockClientKidPurpose,
        }),
        consumerId: tokenClientPurposeEntry.consumerId,
        updatedAt: new Date().toISOString(),
        clientKind: tokenClientPurposeEntry.clientKind,
        publicKey: tokenClientPurposeEntry.publicKey,
        GSIPK_clientId: tokenClientPurposeEntry.GSIPK_clientId,
        GSIPK_kid: tokenClientPurposeEntry.GSIPK_kid,
      };

      expect(retrievedTokenEntries).toHaveLength(2);
      expect(retrievedTokenEntries).toEqual(
        expect.arrayContaining([tokenClientEntry, expectedTokenClientEntry])
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
      await writeClientEntry(clientPlatformStateEntry1, dynamoDBClient);
      await writeClientEntry(clientPlatformStateEntry2, dynamoDBClient);

      // token-generation-states
      const pkTokenStates1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: client.id,
        kid: "kid",
        purposeId,
      });

      const pkTokenStates2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: otherClientId,
        kid: "kid",
        purposeId,
      });

      const clientPurposeTokenStateEntry: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(pkTokenStates1),
          GSIPK_clientId: client.id,
        };

      const otherClientPurposeTokenStateEntry: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(pkTokenStates2),
          GSIPK_clientId: otherClientId,
        };

      await writeTokenStateClientPurposeEntry(
        clientPurposeTokenStateEntry,
        dynamoDBClient
      );
      await writeTokenStateClientPurposeEntry(
        otherClientPurposeTokenStateEntry,
        dynamoDBClient
      );

      await handleMessageV1(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformStatesEntries = await readAllPlatformStateItems(
        dynamoDBClient
      );
      expect(retrievedPlatformStatesEntries).toEqual([
        clientPlatformStateEntry2,
      ]);

      // token-generation-states
      const retrievedTokenEntries = await readAllTokenStateItems(
        dynamoDBClient
      );
      expect(retrievedTokenEntries).toEqual([
        otherClientPurposeTokenStateEntry,
      ]);
    });
  });
});
