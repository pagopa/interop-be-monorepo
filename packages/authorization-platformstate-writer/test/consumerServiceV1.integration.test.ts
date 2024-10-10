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
} from "pagopa-interop-commons-test";
import {
  AuthorizationEventEnvelope,
  Client,
  ClientDeletedV1,
  ClientId,
  clientKindTokenStates,
  ClientPurposeRemovedV1,
  generateId,
  itemState,
  KeyDeletedV1,
  makeGSIPKClientIdPurposeId,
  makeGSIPKKid,
  makePlatformStatesClientPK,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  PlatformStatesClientEntry,
  PurposeId,
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

  // eslint-disable-next-line sonarjs/no-identical-functions
  describe("ClientPurposeAdded", () => {
    it("sample", () => {
      expect(1).toBe(1);
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
