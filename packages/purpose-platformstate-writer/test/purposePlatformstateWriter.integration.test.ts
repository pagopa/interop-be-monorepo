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
import {
  CreateTableCommand,
  CreateTableInput,
  DeleteTableCommand,
  DeleteTableInput,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  getMockPurpose,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test/index.js";
import {
  itemState,
  makePlatformStatesPurposePK,
  NewPurposeVersionActivatedV2,
  PlatformStatesPurposeEntry,
  Purpose,
  PurposeActivatedV2,
  PurposeEventEnvelope,
  PurposeVersion,
  purposeVersionState,
  TokenGenerationStatesClientPurposeEntry,
  toPurposeV2,
} from "pagopa-interop-models";
import { getMockTokenStatesClientPurposeEntry } from "pagopa-interop-commons-test";
import { handleMessageV2 } from "../src/consumerServiceV2.js";
import {
  purposeStateToItemState,
  readPlatformPurposeEntry,
  readTokenEntriesByPurposeId,
  writePlatformPurposeEntry,
} from "../src/utils.js";
import { config, writeTokenStateEntry } from "./utils.js";

describe("integration tests", () => {
  if (!config) {
    fail();
  }
  const dynamoDBClient = new DynamoDBClient({
    credentials: { accessKeyId: "key", secretAccessKey: "secret" },
    region: "eu-central-1",
    endpoint: `http://${config.tokenGenerationReadModelDbHost}:${config.tokenGenerationReadModelDbPort}`,
  });
  beforeEach(async () => {
    if (!config) {
      // TODO: why is this needed?
      fail();
    }
    const platformTableDefinition: CreateTableInput = {
      TableName: config.tokenGenerationReadModelTableNamePlatform,
      AttributeDefinitions: [{ AttributeName: "PK", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
    };
    const command1 = new CreateTableCommand(platformTableDefinition);
    await dynamoDBClient.send(command1);

    const tokenGenerationTableDefinition: CreateTableInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      AttributeDefinitions: [
        { AttributeName: "PK", AttributeType: "S" },
        { AttributeName: "GSIPK_purposeId", AttributeType: "S" },
      ],
      KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
      GlobalSecondaryIndexes: [
        {
          IndexName: "GSIPK_purposeId",
          KeySchema: [
            {
              AttributeName: "GSIPK_purposeId",
              KeyType: "HASH",
            },
          ],
          Projection: {
            NonKeyAttributes: [],
            ProjectionType: "ALL",
          },
        },
      ],
    };
    const command2 = new CreateTableCommand(tokenGenerationTableDefinition);
    await dynamoDBClient.send(command2);
  });
  afterEach(async () => {
    if (!config) {
      fail();
    }
    const tableToDelete1: DeleteTableInput = {
      TableName: config.tokenGenerationReadModelTableNamePlatform,
    };
    const tableToDelete2: DeleteTableInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
    };
    const command1 = new DeleteTableCommand(tableToDelete1);
    await dynamoDBClient.send(command1);
    const command2 = new DeleteTableCommand(tableToDelete2);
    await dynamoDBClient.send(command2);
  });
  const mockDate = new Date();
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  describe("Events V2", async () => {
    describe("PurposeActivated", () => {
      it.skip("no previous entry", async () => {
        const messageVersion = 1;
        const purpose: Purpose = {
          ...getMockPurpose(),
          versions: [getMockPurposeVersion(purposeVersionState.active)],
        };
        const purposeId = purpose.id;
        const purposeVersions = purpose.versions;
        const purposeState = purposeStateToItemState(purpose);
        const payload: PurposeActivatedV2 = {
          purpose: toPurposeV2(purpose),
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeActivated",
          event_version: 2,
          data: payload,
          log_date: new Date(),
        };

        // platform-states
        const purposeEntryPrimaryKey = makePlatformStatesPurposePK(purposeId);
        const previousPlatformPurposeEntry = await readPlatformPurposeEntry(
          dynamoDBClient,
          purposeEntryPrimaryKey
        );
        expect(previousPlatformPurposeEntry).toBeUndefined();

        // token-generation-states
        const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(),
            GSIPK_purposeId: purposeId,
            purposeState: itemState.inactive,
          };
        await writeTokenStateEntry(dynamoDBClient, previousTokenStateEntry1);

        const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(),
            GSIPK_purposeId: purposeId,
            purposeState,
          };
        await writeTokenStateEntry(dynamoDBClient, previousTokenStateEntry2);

        await handleMessageV2(message, dynamoDBClient);

        // platform-states
        const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
          dynamoDBClient,
          purposeEntryPrimaryKey
        );
        const expectedPlatformPurposeEntry: PlatformStatesPurposeEntry = {
          PK: purposeEntryPrimaryKey,
          state: itemState.active,
          purposeVersionId: purposeVersions[0].id,
          purposeEserviceId: purpose.eserviceId,
          purposeConsumerId: purpose.consumerId,
          version: messageVersion,
          updatedAt: new Date().toISOString(),
        };
        expect(retrievedPlatformPurposeEntry).toEqual(
          expectedPlatformPurposeEntry
        );
        expect(retrievedPlatformPurposeEntry).toEqual(
          expectedPlatformPurposeEntry
        );

        // token-generation-states;
        const retrievedTokenStateEntries = await readTokenEntriesByPurposeId(
          dynamoDBClient,
          purposeId
        );
        const expectedTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
          {
            ...previousTokenStateEntry1,
            purposeState: itemState.active,
            purposeVersionId: purposeVersions[0].id,
            updatedAt: new Date().toISOString(),
          };
        const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
          {
            ...previousTokenStateEntry2,
            purposeState: itemState.active,
            purposeVersionId: purposeVersions[0].id,
            updatedAt: new Date().toISOString(),
          };
        // FIX: add updated fields
        expect(retrievedTokenStateEntries).toHaveLength(2);
        expect(retrievedTokenStateEntries).toEqual(
          expect.arrayContaining([
            expectedTokenStateEntry1,
            expectedTokenStateEntry2,
          ])
        );
      });

      it("no operation if the entry already exists: incoming has version 1; previous entry has version 2", async () => {
        const previousEntryVersion = 2;
        const messageVersion = 1;
        const purpose: Purpose = {
          ...getMockPurpose(),
          versions: [getMockPurposeVersion()],
        };
        const payload: PurposeActivatedV2 = {
          purpose: toPurposeV2(purpose),
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purpose.id,
          version: messageVersion,
          type: "PurposeActivated",
          event_version: 2,
          data: payload,
          log_date: new Date(),
        };

        // platform-states
        const purposeEntryPrimaryKey = makePlatformStatesPurposePK(purpose.id);
        const previousStateEntry: PlatformStatesPurposeEntry = {
          PK: purposeEntryPrimaryKey,
          state: purposeStateToItemState(purpose),
          purposeVersionId: purpose.versions[0].id,
          purposeEserviceId: purpose.eserviceId,
          purposeConsumerId: purpose.consumerId,
          version: previousEntryVersion,
          updatedAt: mockDate.toISOString(),
        };
        await writePlatformPurposeEntry(dynamoDBClient, previousStateEntry);

        // token-generation-states
        const purposeId = purpose.id;
        const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(),
            GSIPK_purposeId: purposeId,
            purposeState: itemState.inactive,
          };
        await writeTokenStateEntry(dynamoDBClient, previousTokenStateEntry1);

        const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(),
            GSIPK_purposeId: purposeId,
            purposeState: itemState.inactive,
          };
        await writeTokenStateEntry(dynamoDBClient, previousTokenStateEntry2);

        await handleMessageV2(message, dynamoDBClient);

        // platform-states
        const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
          dynamoDBClient,
          purposeEntryPrimaryKey
        );
        expect(retrievedPlatformPurposeEntry).toEqual(previousStateEntry);

        // token-generation-states
        const retrievedTokenStateEntries = await readTokenEntriesByPurposeId(
          dynamoDBClient,
          purposeId
        );

        expect(retrievedTokenStateEntries).toHaveLength(2);
        expect(retrievedTokenStateEntries).toEqual(
          expect.arrayContaining([
            previousTokenStateEntry1,
            previousTokenStateEntry2,
          ])
        );
      });

      it.skip("entry has to be updated: incoming has version 3; previous entry has version 2", async () => {
        const previousEntryVersion = 2;
        const messageVersion = 3;
        const purpose: Purpose = {
          ...getMockPurpose(),
          versions: [getMockPurposeVersion()],
          suspendedByConsumer: false,
          suspendedByProducer: false,
        };
        const purposeVersions = purpose.versions;
        const payload: PurposeActivatedV2 = {
          purpose: toPurposeV2(purpose),
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purpose.id,
          version: messageVersion,
          type: "PurposeActivated",
          event_version: 2,
          data: payload,
          log_date: new Date(),
        };

        // platform-states
        const purposeEntryPrimaryKey = makePlatformStatesPurposePK(purpose.id);
        const previousStateEntry: PlatformStatesPurposeEntry = {
          PK: purposeEntryPrimaryKey,
          state: purposeStateToItemState(purpose),
          purposeVersionId: purposeVersions[0].id,
          purposeEserviceId: purpose.eserviceId,
          purposeConsumerId: purpose.consumerId,
          version: previousEntryVersion,
          updatedAt: mockDate.toISOString(),
        };
        await writePlatformPurposeEntry(dynamoDBClient, previousStateEntry);

        // token-generation-states
        const purposeId = purpose.id;
        const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(),
            GSIPK_purposeId: purposeId,
            purposeState: itemState.inactive,
          };
        await writeTokenStateEntry(dynamoDBClient, previousTokenStateEntry1);

        const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(),
            GSIPK_purposeId: purposeId,
            purposeState: itemState.inactive,
          };
        await writeTokenStateEntry(dynamoDBClient, previousTokenStateEntry2);

        await handleMessageV2(message, dynamoDBClient);

        // platform-states
        const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
          dynamoDBClient,
          purposeEntryPrimaryKey
        );
        const expectedPlatformPurposeEntry: PlatformStatesPurposeEntry = {
          ...previousStateEntry,
          state: itemState.active,
          version: messageVersion,
          updatedAt: new Date().toISOString(),
        };
        expect(retrievedPlatformPurposeEntry).toEqual(
          expectedPlatformPurposeEntry
        );

        // FIX: add updated fields
        // token-generation-states;
        const retrievedTokenStateEntries = await readTokenEntriesByPurposeId(
          dynamoDBClient,
          purposeId
        );
        const expectedTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
          {
            ...previousTokenStateEntry1,
            purposeState: itemState.active,
            purposeVersionId: purposeVersions[0].id,
            updatedAt: new Date().toISOString(),
          };
        const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
          {
            ...previousTokenStateEntry2,
            purposeState: itemState.active,
            purposeVersionId: purposeVersions[0].id,
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

    describe("NewPurposeVersionActivated", async () => {
      // TODO: same test as PurposeActivated no operation
      // it("no operation if the entry already exists: incoming has version 1; previous entry has version 2", async () => {
      // });

      it("entry has to be updated: incoming has version 3; previous entry has version 2", async () => {
        const previousEntryVersion = 2;
        const messageVersion = 3;

        const purposeVersions: PurposeVersion[] = [
          { ...getMockPurposeVersion(), state: purposeVersionState.active },
          {
            ...getMockPurposeVersion(),
            state: purposeVersionState.waitingForApproval,
          },
        ];
        const purpose: Purpose = {
          ...getMockPurpose(),
          versions: purposeVersions,
        };
        const purposeId = purpose.id;
        const purposeState = purposeStateToItemState(purpose);

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
              state: purposeVersionState.archived,
              updatedAt: new Date(),
            },
            {
              ...purposeVersions[1],
              state: purposeVersionState.active,
              firstActivationAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        };

        const payload: NewPurposeVersionActivatedV2 = {
          purpose: toPurposeV2(updatedPurpose),
          versionId: purposeVersions[1].id,
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "NewPurposeVersionActivated",
          event_version: 2,
          data: payload,
          log_date: new Date(),
        };

        await handleMessageV2(message, dynamoDBClient);

        // platform-states
        const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
          dynamoDBClient,
          purposeEntryPrimaryKey
        );
        const expectedPlatformPurposeEntry: PlatformStatesPurposeEntry = {
          ...previousStateEntry,
          state: itemState.active,
          purposeVersionId: purposeVersions[1].id,
          version: messageVersion,
          updatedAt: new Date().toISOString(),
        };
        expect(retrievedPlatformPurposeEntry).toEqual(
          expectedPlatformPurposeEntry
        );

        // token-generation-states
        const retrievedTokenStateEntries = await readTokenEntriesByPurposeId(
          dynamoDBClient,
          purposeId
        );
        const expectedTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
          {
            ...previousTokenStateEntry1,
            purposeState: itemState.active,
            purposeVersionId: purposeVersions[1].id,
            updatedAt: new Date().toISOString(),
          };
        const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
          {
            ...previousTokenStateEntry2,
            purposeState: itemState.active,
            purposeVersionId: purposeVersions[1].id,
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
      it("should not throw error if entry doesn't exist", async () => {
        const messageVersion = 3;

        const purposeVersions: PurposeVersion[] = [
          { ...getMockPurposeVersion(), state: purposeVersionState.active },
          {
            ...getMockPurposeVersion(),
            state: purposeVersionState.waitingForApproval,
          },
        ];
        const purpose: Purpose = {
          ...getMockPurpose(),
          versions: purposeVersions,
        };
        const purposeId = purpose.id;

        // platform-states
        const purposeEntryPrimaryKey = makePlatformStatesPurposePK(purposeId);
        const previousRetrievedPlatformPurposeEntry =
          await readPlatformPurposeEntry(
            dynamoDBClient,
            purposeEntryPrimaryKey
          );
        expect(previousRetrievedPlatformPurposeEntry).toBeUndefined();

        const updatedPurpose: Purpose = {
          ...purpose,
          versions: [
            {
              ...purposeVersions[0],
              state: purposeVersionState.archived,
              updatedAt: new Date(),
            },
            {
              ...purposeVersions[1],
              state: purposeVersionState.active,
              firstActivationAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        };

        const payload: NewPurposeVersionActivatedV2 = {
          purpose: toPurposeV2(purpose),
          versionId: updatedPurpose.versions[1].id,
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "NewPurposeVersionActivated",
          event_version: 2,
          data: payload,
          log_date: new Date(),
        };

        expect(
          async () => await handleMessageV2(message, dynamoDBClient)
        ).not.toThrow();

        // platform-states
        const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
          dynamoDBClient,
          purposeEntryPrimaryKey
        );
        expect(retrievedPlatformPurposeEntry).toBeUndefined();
      });
    });
  });
});
