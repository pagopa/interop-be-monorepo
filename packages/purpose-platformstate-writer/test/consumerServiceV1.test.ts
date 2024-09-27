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
  getMockPurpose,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test";
import {
  generateId,
  itemState,
  makePlatformStatesPurposePK,
  makeTokenGenerationStatesClientKidPurposePK,
  PlatformStatesPurposeEntry,
  Purpose,
  PurposeEventEnvelope,
  PurposeVersion,
  PurposeVersionArchivedV1,
  purposeVersionState,
  PurposeVersionSuspendedV1,
  TokenGenerationStatesClientPurposeEntry,
} from "pagopa-interop-models";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockTokenStatesClientPurposeEntry,
} from "pagopa-interop-commons-test";
import { handleMessageV1 } from "../src/consumerServiceV1.js";
import {
  getPurposeStateFromPurposeVersions,
  readPlatformPurposeEntry,
  readTokenEntriesByGSIPKPurposeId,
  writePlatformPurposeEntry,
} from "../src/utils.js";
import { config, toPurposeV1, writeTokenStateEntry } from "./utils.js";

describe("integration tests for consumerServiceV1", () => {
  if (!config) {
    fail();
  }

  const dynamoDBClient = new DynamoDBClient({
    endpoint: `http://${config.tokenGenerationReadModelDbHost}:${config.tokenGenerationReadModelDbPort}`,
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

  describe("Events V1", async () => {
    describe("PurposeVersionSuspended", () => {
      it("should do no operation if the entry already exists: incoming message has version 1; previous entry has version 2", async () => {
        const previousEntryVersion = 2;
        const messageVersion = 1;

        const purposeVersions: PurposeVersion[] = [
          getMockPurposeVersion(purposeVersionState.active),
        ];
        const purpose: Purpose = {
          ...getMockPurpose(),
          versions: purposeVersions,
        };
        const purposeId = purpose.id;
        const purposeState = getPurposeStateFromPurposeVersions(
          purpose.versions
        );

        // platform-states
        const purposeEntryPrimaryKey = makePlatformStatesPurposePK(purposeId);
        const previousPlatformEntry: PlatformStatesPurposeEntry = {
          PK: purposeEntryPrimaryKey,
          state: purposeState,
          purposeVersionId: purposeVersions[0].id,
          purposeEserviceId: purpose.eserviceId,
          purposeConsumerId: purpose.consumerId,
          version: previousEntryVersion,
          updatedAt: mockDate.toISOString(),
        };
        await writePlatformPurposeEntry(dynamoDBClient, previousPlatformEntry);

        // token-generation-states
        const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(),
            GSIPK_purposeId: purposeId,
            purposeState,
            purposeVersionId: purposeVersions[0].id,
          };
        await writeTokenStateEntry(dynamoDBClient, previousTokenStateEntry1);

        const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(),
            GSIPK_purposeId: purposeId,
            purposeState,
            purposeVersionId: purposeVersions[0].id,
          };
        await writeTokenStateEntry(dynamoDBClient, previousTokenStateEntry2);

        const updatedPurpose: Purpose = {
          ...purpose,
          versions: [
            {
              ...purposeVersions[0],
              state: purposeVersionState.suspended,
              suspendedAt: new Date(),
            },
          ],
        };

        const payload: PurposeVersionSuspendedV1 = {
          purpose: toPurposeV1(updatedPurpose),
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionSuspended",
          event_version: 1,
          data: payload,
          log_date: new Date(),
        };

        await handleMessageV1(message, dynamoDBClient);

        // platform-states
        const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
          dynamoDBClient,
          purposeEntryPrimaryKey
        );
        expect(retrievedPlatformPurposeEntry).toEqual(previousPlatformEntry);

        // token-generation-states
        const retrievedTokenStateEntries =
          await readTokenEntriesByGSIPKPurposeId(dynamoDBClient, purposeId);
        expect(retrievedTokenStateEntries).toHaveLength(2);
        expect(retrievedTokenStateEntries).toEqual(
          expect.arrayContaining([
            previousTokenStateEntry1,
            previousTokenStateEntry2,
          ])
        );
      });

      // TODO: fix this. What do suspendedByConsumer and suspendedByProducer become?
      it("should update the entry if the message version is more recent", async () => {
        const previousEntryVersion = 1;
        const messageVersion = 2;

        const purposeVersions: PurposeVersion[] = [
          getMockPurposeVersion(purposeVersionState.active),
        ];
        const purpose: Purpose = {
          ...getMockPurpose(),
          versions: purposeVersions,
        };
        const purposeId = purpose.id;
        const purposeState = getPurposeStateFromPurposeVersions(
          purpose.versions
        );

        // platform-states
        const purposeEntryPrimaryKey = makePlatformStatesPurposePK(purposeId);
        const previousStateEntry: PlatformStatesPurposeEntry = {
          PK: purposeEntryPrimaryKey,
          state: purposeState,
          purposeVersionId: purposeVersions[0].id,
          purposeEserviceId: purpose.eserviceId,
          purposeConsumerId: purpose.consumerId,
          version: previousEntryVersion,
          updatedAt: mockDate.toISOString(),
        };
        await writePlatformPurposeEntry(dynamoDBClient, previousStateEntry);

        // token-generation-states
        const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(),
            GSIPK_purposeId: purposeId,
            purposeState,
            purposeVersionId: purposeVersions[0].id,
          };
        await writeTokenStateEntry(dynamoDBClient, previousTokenStateEntry1);

        const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(),
            GSIPK_purposeId: purposeId,
            purposeState,
            purposeVersionId: purposeVersions[0].id,
          };
        await writeTokenStateEntry(dynamoDBClient, previousTokenStateEntry2);

        const updatedPurpose: Purpose = {
          ...purpose,
          versions: [
            {
              ...purposeVersions[0],
              state: purposeVersionState.suspended,
              suspendedAt: new Date(),
            },
          ],
        };

        const payload: PurposeVersionSuspendedV1 = {
          purpose: toPurposeV1(updatedPurpose),
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionSuspended",
          event_version: 1,
          data: payload,
          log_date: new Date(),
        };

        await handleMessageV1(message, dynamoDBClient);

        // platform-states
        const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
          dynamoDBClient,
          purposeEntryPrimaryKey
        );
        const expectedPlatformPurposeEntry: PlatformStatesPurposeEntry = {
          ...previousStateEntry,
          state: itemState.inactive,
          version: messageVersion,
          updatedAt: new Date().toISOString(),
        };
        expect(retrievedPlatformPurposeEntry).toEqual(
          expectedPlatformPurposeEntry
        );

        // token-generation-states
        const retrievedTokenStateEntries =
          await readTokenEntriesByGSIPKPurposeId(dynamoDBClient, purposeId);
        const expectedTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
          {
            ...previousTokenStateEntry1,
            purposeState: itemState.inactive,
            updatedAt: new Date().toISOString(),
          };
        const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
          {
            ...previousTokenStateEntry2,
            purposeState: itemState.inactive,
            updatedAt: new Date().toISOString(),
          };
        expect(retrievedTokenStateEntries).toHaveLength(2);
        expect(retrievedTokenStateEntries).toEqual(
          expect.arrayContaining([
            expectedTokenStateEntry1,
            expectedTokenStateEntry2,
          ])
        );
      });

      it("should not throw error if the entry doesn't exist", async () => {
        const messageVersion = 1;

        const purpose: Purpose = {
          ...getMockPurpose(),
          versions: [getMockPurposeVersion(purposeVersionState.active)],
        };
        const purposeId = purpose.id;
        const purposeState = getPurposeStateFromPurposeVersions(
          purpose.versions
        );
        const purposeVersions: PurposeVersion[] = [
          getMockPurposeVersion(purposeVersionState.active),
        ];

        // platform-states
        const purposeEntryPrimaryKey = makePlatformStatesPurposePK(purposeId);
        const previousRetrievedPlatformPurposeEntry =
          await readPlatformPurposeEntry(
            dynamoDBClient,
            purposeEntryPrimaryKey
          );
        expect(previousRetrievedPlatformPurposeEntry).toBeUndefined();

        // token-generation-states
        const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
        const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
            GSIPK_purposeId: purposeId,
            purposeVersionId: purposeVersions[0].id,
            purposeState,
          };
        await writeTokenStateEntry(dynamoDBClient, previousTokenStateEntry1);

        const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
        const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
            GSIPK_purposeId: purposeId,
            purposeVersionId: purposeVersions[0].id,
            purposeState,
          };
        await writeTokenStateEntry(dynamoDBClient, previousTokenStateEntry2);

        const updatedPurposeVersions: PurposeVersion[] = [
          {
            ...purposeVersions[0],
            state: purposeVersionState.suspended,
            suspendedAt: new Date(),
          },
        ];

        const updatedPurpose: Purpose = {
          ...purpose,
          versions: updatedPurposeVersions,
        };

        const payload: PurposeVersionSuspendedV1 = {
          purpose: toPurposeV1(updatedPurpose),
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionSuspended",
          event_version: 1,
          data: payload,
          log_date: new Date(),
        };

        expect(
          async () => await handleMessageV1(message, dynamoDBClient)
        ).not.toThrowError();

        // platform-states
        const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
          dynamoDBClient,
          purposeEntryPrimaryKey
        );
        expect(retrievedPlatformPurposeEntry).toBeUndefined();

        // token-generation-states
        const retrievedTokenStateEntries =
          await readTokenEntriesByGSIPKPurposeId(dynamoDBClient, purposeId);
        expect(retrievedTokenStateEntries).toHaveLength(2);
        expect(retrievedTokenStateEntries).toEqual(
          expect.arrayContaining([
            previousTokenStateEntry1,
            previousTokenStateEntry2,
          ])
        );
      });
    });

    describe("PurposeVersionArchived", () => {
      it("should delete the entry", async () => {
        const previousEntryVersion = 1;
        const messageVersion = 2;

        const purposeVersions: PurposeVersion[] = [
          getMockPurposeVersion(purposeVersionState.active),
        ];
        const purpose: Purpose = {
          ...getMockPurpose(),
          versions: purposeVersions,
        };
        const purposeId = purpose.id;
        const purposeState = getPurposeStateFromPurposeVersions(
          purpose.versions
        );

        // platform-states
        const purposeEntryPrimaryKey = makePlatformStatesPurposePK(purposeId);
        const previousStateEntry: PlatformStatesPurposeEntry = {
          PK: purposeEntryPrimaryKey,
          state: purposeState,
          purposeVersionId: purposeVersions[0].id,
          purposeEserviceId: purpose.eserviceId,
          purposeConsumerId: purpose.consumerId,
          version: previousEntryVersion,
          updatedAt: mockDate.toISOString(),
        };
        await writePlatformPurposeEntry(dynamoDBClient, previousStateEntry);

        // token-generation-states
        const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
        const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
            GSIPK_purposeId: purposeId,
            purposeState,
          };
        await writeTokenStateEntry(dynamoDBClient, previousTokenStateEntry1);

        const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
        const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
            GSIPK_purposeId: purposeId,
            purposeState,
          };
        await writeTokenStateEntry(dynamoDBClient, previousTokenStateEntry2);

        const updatedPurpose: Purpose = {
          ...purpose,
          versions: [
            {
              ...purposeVersions[0],
              state: purposeVersionState.archived,
              updatedAt: new Date(),
            },
          ],
        };

        const payload: PurposeVersionArchivedV1 = {
          purpose: toPurposeV1(updatedPurpose),
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionArchived",
          event_version: 1,
          data: payload,
          log_date: new Date(),
        };

        await handleMessageV1(message, dynamoDBClient);

        // platform-states
        const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
          dynamoDBClient,
          purposeEntryPrimaryKey
        );
        expect(retrievedPlatformPurposeEntry).toBeUndefined();

        // token-generation-states
        const retrievedTokenStateEntries =
          await readTokenEntriesByGSIPKPurposeId(dynamoDBClient, purposeId);
        const expectedTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
          {
            ...previousTokenStateEntry1,
            purposeState: itemState.inactive,
            updatedAt: new Date().toISOString(),
          };
        const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
          {
            ...previousTokenStateEntry2,
            purposeState: itemState.inactive,
            updatedAt: new Date().toISOString(),
          };
        expect(retrievedTokenStateEntries).toHaveLength(2);
        expect(retrievedTokenStateEntries).toEqual(
          expect.arrayContaining([
            expectedTokenStateEntry1,
            expectedTokenStateEntry2,
          ])
        );
      });
    });
  });
});
