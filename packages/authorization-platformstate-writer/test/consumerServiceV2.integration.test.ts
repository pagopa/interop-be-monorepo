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
  ClientDeletedV2,
  ClientId,
  ClientKeyDeletedV2,
  ClientPurposeRemovedV2,
  generateId,
  itemState,
  makeGSIPKClientIdPurposeId,
  makeGSIPKKid,
  makePlatformStatesClientPK,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  PlatformStatesClientEntry,
  PurposeId,
  toClientV2,
  TokenGenerationStatesClientEntry,
  TokenGenerationStatesClientPurposeEntry,
  unsafeBrandId,
} from "pagopa-interop-models";
import { handleMessageV2 } from "../src/consumerServiceV2.js";
import {
  readClientEntry,
  writeClientEntry,
  writeTokenStateClientEntry,
  writeTokenStateClientPurposeEntry,
} from "../src/utils.js";
import { config } from "./utils.js";

describe("integration tests V2 events", async () => {
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

  describe("ClientKeyAdded", () => {
    it("sample", () => {
      expect(1).toBe(1);
    });
  });

  describe("ClientKeyDeleted", () => {
    it("should do no operation if the existing table entry is more recent", async () => {
      const previousPlatformEntryVersion = 2;
      const messageVersion = 1;

      const purposeId = generateId<PurposeId>();
      const client: Client = {
        ...getMockClient(),
        purposes: [purposeId],
      };
      const kidToRemove = "removed kid";

      const payload: ClientKeyDeletedV2 = {
        client: toClientV2(client),
        kid: kidToRemove,
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientKeyDeleted",
        event_version: 2,
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
      };
      await writeClientEntry(previousPlatformClientEntry, dynamoDBClient);

      // token-generation-states
      const GSIPK_clientId = client.id;
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: kidToRemove,
      });
      const tokenClientEntry: TokenGenerationStatesClientEntry = {
        ...getMockTokenStatesClientEntry(tokenClientKidPK),
        GSIPK_clientId: unsafeBrandId(GSIPK_clientId),
        GSIPK_kid: makeGSIPKKid(kidToRemove),
      };
      await writeTokenStateClientEntry(tokenClientEntry, dynamoDBClient);

      await handleMessageV2(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformClientEntry = await readClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toEqual(previousPlatformClientEntry);

      // token-generation-states
      const retrievedEntries = await readAllTokenStateItems(dynamoDBClient);
      expect(retrievedEntries).toEqual([tokenClientEntry]);
    });

    it("should insert platform-states entry and delete token-generation-states entries for that kid", async () => {
      const messageVersion = 2;

      const purposeId = generateId<PurposeId>();
      const client: Client = {
        ...getMockClient(),
        purposes: [purposeId],
      };
      const kidToRemove = "removed kid";

      const payload: ClientKeyDeletedV2 = {
        client: toClientV2(client),
        kid: kidToRemove,
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientKeyDeleted",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };

      // token-generation-states
      const GSIPK_clientId = client.id;
      const tokenClientKidPurposePK =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: kidToRemove,
          purposeId,
        });

      const tokenClientPurposeEntryWithKid: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenClientKidPurposePK),
          GSIPK_kid: makeGSIPKKid(kidToRemove),
          GSIPK_clientId: unsafeBrandId(GSIPK_clientId),
        };
      const tokenClientPurposeEntryWithOtherKid: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(),
          GSIPK_clientId: unsafeBrandId(GSIPK_clientId),
        };

      await writeTokenStateClientPurposeEntry(
        tokenClientPurposeEntryWithKid,
        dynamoDBClient
      );
      await writeTokenStateClientPurposeEntry(
        tokenClientPurposeEntryWithOtherKid,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient);

      // platform-states
      const platformClientPK = makePlatformStatesClientPK(client.id);
      const retrievedPlatformStatesEntry = await readClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        clientPurposesIds: [],
        state: itemState.active,
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformStatesEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedEntries = await readAllTokenStateItems(dynamoDBClient);
      expect(retrievedEntries).toEqual([tokenClientPurposeEntryWithOtherKid]);
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

      const payload: ClientKeyDeletedV2 = {
        client: toClientV2(client),
        kid: kidToRemove,
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientKeyDeleted",
        event_version: 2,
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
        clientPurposesIds: [purposeId],
      };
      await writeClientEntry(previousPlatformClientEntry, dynamoDBClient);

      // token-generation-states
      const GSIPK_clientId = client.id;
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

      const tokenClientPurposeEntryWithKid: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(),
          PK: tokenClientKidPurposePK,
          GSIPK_kid: makeGSIPKKid(kidToRemove),
          GSIPK_clientId: unsafeBrandId(GSIPK_clientId),
        };

      const tokenClientEntryWithOtherKid: TokenGenerationStatesClientEntry = {
        ...getMockTokenStatesClientEntry(tokenClientKidPK),
        GSIPK_clientId: unsafeBrandId(GSIPK_clientId),
        GSIPK_kid: makeGSIPKKid(otherKid),
      };

      await writeTokenStateClientPurposeEntry(
        tokenClientPurposeEntryWithKid,
        dynamoDBClient
      );
      await writeTokenStateClientEntry(
        tokenClientEntryWithOtherKid,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformStatesEntry = await readClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        clientPurposesIds: [],
        state: itemState.active,
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformStatesEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedEntries = await readAllTokenStateItems(dynamoDBClient);
      expect(retrievedEntries).toEqual([tokenClientEntryWithOtherKid]);
    });
  });

  describe("ClientPurposeAdded", () => {
    it("sample 2", () => {
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

      const payload: ClientPurposeRemovedV2 = {
        purposeId,
        client: toClientV2(client),
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientPurposeRemoved",
        event_version: 2,
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
      };
      await writeClientEntry(previousPlatformClientEntry, dynamoDBClient);

      // token-generation-states
      const GSIPK_clientId = client.id;
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: "KID",
      });
      const tokenClientEntry: TokenGenerationStatesClientEntry = {
        ...getMockTokenStatesClientEntry(tokenClientKidPK),
        GSIPK_clientId: unsafeBrandId(GSIPK_clientId),
      };
      await writeTokenStateClientEntry(tokenClientEntry, dynamoDBClient);

      await handleMessageV2(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformClientEntry = await readClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toEqual(previousPlatformClientEntry);

      // token-generation-states
      const retrievedEntries = await readAllTokenStateItems(dynamoDBClient);
      expect(retrievedEntries).toEqual([tokenClientEntry]);
    });

    it("should do no operation if the existing table entry doesn't exist", async () => {
      const messageVersion = 1;

      const purposeId = generateId<PurposeId>();
      const client: Client = {
        ...getMockClient(),
        purposes: [purposeId],
      };

      const payload: ClientPurposeRemovedV2 = {
        purposeId,
        client: toClientV2(client),
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientPurposeRemoved",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformClientPK = makePlatformStatesClientPK(client.id);
      expect(
        await readClientEntry(platformClientPK, dynamoDBClient)
      ).toBeUndefined();

      // token-generation-states
      const GSIPK_clientId = client.id;
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: "KID",
      });

      const tokenClientEntry: TokenGenerationStatesClientEntry = {
        ...getMockTokenStatesClientEntry(tokenClientKidPK),
        GSIPK_clientId: unsafeBrandId(GSIPK_clientId),
      };
      await writeTokenStateClientEntry(tokenClientEntry, dynamoDBClient);

      await handleMessageV2(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformClientEntry = await readClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toBeUndefined();

      // token-generation-states
      const retrievedEntries = await readAllTokenStateItems(dynamoDBClient);
      expect(retrievedEntries).toEqual([tokenClientEntry]);
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

      const payload: ClientPurposeRemovedV2 = {
        purposeId: purposeId2,
        client: toClientV2(client),
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientPurposeRemoved",
        event_version: 2,
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

      await handleMessageV2(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformStatesEntry = await readClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        clientPurposesIds: [],
        state: itemState.active,
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformStatesEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedEntries = await readAllTokenStateItems(dynamoDBClient);
      expect(retrievedEntries).toEqual(
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

      const payload: ClientPurposeRemovedV2 = {
        purposeId,
        client: toClientV2(client),
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientPurposeRemoved",
        event_version: 2,
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

      await handleMessageV2(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformStatesEntry = await readClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformStatesEntry).toBeUndefined();

      // token-generation-states
      const retrievedEntries = await readAllTokenStateItems(dynamoDBClient);
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
      expect(retrievedEntries).toEqual(
        expect.arrayContaining([tokenClientEntry, expectedTokenClientEntry])
      );
    });
  });

  describe("ClientDeleted", () => {
    it("should delete platform-states entry and token-generation-states entries", async () => {
      const messageVersion = 2;

      const purposeId = generateId<PurposeId>();
      const client = getMockClient();

      const payload: ClientDeletedV2 = {
        client: toClientV2(client),
        clientId: client.id,
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientDeleted",
        event_version: 2,
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
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [],
      };

      const pk2PlatformStates = makePlatformStatesClientPK(otherClientId);
      const clientPlatformStateEntry2: PlatformStatesClientEntry = {
        PK: pk2PlatformStates,
        version: 1,
        state: itemState.active,
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

      await handleMessageV2(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformStatesEntries = await readAllPlatformStateItems(
        dynamoDBClient
      );
      expect(retrievedPlatformStatesEntries).toEqual([
        clientPlatformStateEntry2,
      ]);

      // token-generation-states
      const retrievedTokenStatesEntries = await readAllTokenStateItems(
        dynamoDBClient
      );
      expect(retrievedTokenStatesEntries).toEqual([
        otherClientPurposeTokenStateEntry,
      ]);
    });
  });
});
