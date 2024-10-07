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
  getMockKey,
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
  clientKindTokenStates,
  generateId,
  itemState,
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
    it("should delete entries in token-generation-states for that kid", async () => {
      const purposeId = generateId<PurposeId>();
      const client: Client = {
        ...getMockClient(),
        purposes: [purposeId],
        keys: [getMockKey()],
      };
      const kidToRemove = "removed kid";

      const payload: ClientKeyDeletedV2 = {
        client: toClientV2(client),
        kid: kidToRemove,
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: 2,
        type: "ClientKeyDeleted",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const GSIPK_clientId = client.id;
      const pk1 = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: kidToRemove,
      });
      const pk2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: client.id,
        kid: kidToRemove,
        purposeId,
      });
      const pk3 = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
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

      await handleMessageV2(message, dynamoDBClient);

      const retrievedEntries = await readAllTokenStateItems(dynamoDBClient);

      expect(retrievedEntries).toEqual([clientEntryWithOtherKid]);
    });
  });

  describe("ClientPurposeAdded", () => {
    it("sample", () => {
      expect(1).toBe(1);
    });
  });

  describe("ClientPurposeRemoved", () => {
    it("sample", () => {
      expect(1).toBe(1);
    });
  });

  describe("ClientDeleted", () => {
    it("should delete platform-state entry and token-generation-states entries", async () => {
      const purposeId = generateId<PurposeId>();
      const client: Client = {
        ...getMockClient(),
        purposes: [purposeId],
        keys: [getMockKey()],
      };

      const payload: ClientDeletedV2 = {
        client: toClientV2(client),
        clientId: client.id,
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: 2,
        type: "ClientDeleted",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };

      const otherClientId = generateId<ClientId>();

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

      const pkTokenStates1 = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: "kid",
      });
      const pkTokenStates2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: client.id,
        kid: "kid",
        purposeId,
      });

      const pkTokenStates3 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: otherClientId,
        kid: "kid",
        purposeId,
      });

      const clientTokenStateEntry: TokenGenerationStatesClientEntry = {
        PK: pkTokenStates1,
        consumerId: generateId(),
        updatedAt: new Date().toISOString(),
        clientKind: clientKindTokenStates.consumer,
        publicKey: "PEM",
        GSIPK_clientId: client.id,
        GSIPK_kid: makeGSIPKKid("kid"),
      };

      const clientPurposeTokenStateEntry: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(),
          PK: pkTokenStates2,
          GSIPK_kid: makeGSIPKKid("kid"),
          GSIPK_clientId: client.id,
        };

      const otherClientPurposeTokenStateEntry: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(),
          PK: pkTokenStates3,
          GSIPK_kid: makeGSIPKKid("kid"),
          GSIPK_clientId: otherClientId,
        };

      await writeClientEntry(clientPlatformStateEntry1, dynamoDBClient);
      await writeClientEntry(clientPlatformStateEntry2, dynamoDBClient);
      await writeTokenStateClientEntry(clientTokenStateEntry, dynamoDBClient);
      await writeTokenStateClientPurposeEntry(
        clientPurposeTokenStateEntry,
        dynamoDBClient
      );
      await writeTokenStateClientPurposeEntry(
        otherClientPurposeTokenStateEntry,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient);

      const retrievedPlatformStatesEntries = await readAllPlatformStateItems(
        dynamoDBClient
      );

      const retrievedTokenStatesEntries = await readAllTokenStateItems(
        dynamoDBClient
      );

      expect(retrievedPlatformStatesEntries).toEqual([
        clientPlatformStateEntry2,
      ]);
      expect(retrievedTokenStatesEntries).toEqual([
        otherClientPurposeTokenStateEntry,
      ]);
    });
  });
});
