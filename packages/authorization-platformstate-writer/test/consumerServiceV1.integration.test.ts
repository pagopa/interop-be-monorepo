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
  getMockTokenStatesClientPurposeEntry,
  readAllPlatformStateItems,
  readAllTokenStateItems,
} from "pagopa-interop-commons-test";
import {
  AuthorizationEventEnvelope,
  ClientDeletedV1,
  ClientId,
  clientKindTokenStates,
  generateId,
  itemState,
  KeyDeletedV1,
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

  // eslint-disable-next-line sonarjs/no-identical-functions
  describe("ClientPurposeRemoved", () => {
    it("sample", () => {
      expect(1).toBe(1);
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
