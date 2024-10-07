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
  readAllTokenStateItems,
} from "pagopa-interop-commons-test";
import {
  AuthorizationEventEnvelope,
  Client,
  ClientKeyDeletedV2,
  clientKindTokenStates,
  ClientKindTokenStates,
  generateId,
  GSIPKKid,
  makeGSIPKClient,
  makeGSIPKKid,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  PurposeId,
  toClientV2,
  TokenGenerationStatesClientEntry,
  TokenGenerationStatesClientPurposeEntry,
  unsafeBrandId,
} from "pagopa-interop-models";
import { handleMessageV2 } from "../src/consumerServiceV2.js";
import {
  writeTokenStateClientEntry,
  writeTokenStateClientPurposeEntry,
} from "../src/utils.js";
import { config, sleep } from "./utils.js";

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
      const GSIPK_clientId = makeGSIPKClient(client.id);
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
    it("sample", () => {
      expect(1).toBe(1);
    });
  });
});
