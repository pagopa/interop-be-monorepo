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
  getMockAgreement,
  getMockPurpose,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test/index.js";
import {
  generateId,
  itemState,
  makeGSIPKConsumerIdEServiceId,
  makePlatformStatesAgreementPK,
  makePlatformStatesPurposePK,
  makeTokenGenerationStatesClientKidPurposePK,
  NewPurposeVersionActivatedV2,
  PlatformStatesAgreementEntry,
  PlatformStatesPurposeEntry,
  Purpose,
  PurposeActivatedV2,
  PurposeArchivedV2,
  PurposeEventEnvelope,
  PurposeVersion,
  PurposeVersionActivatedV2,
  purposeVersionState,
  PurposeVersionSuspendedByConsumerV2,
  PurposeVersionSuspendedByProducerV2,
  PurposeVersionUnsuspendedByConsumerV2,
  PurposeVersionUnsuspendedByProducerV2,
  TokenGenerationStatesClientPurposeEntry,
  toPurposeV2,
} from "pagopa-interop-models";
import { getMockTokenStatesClientPurposeEntry } from "pagopa-interop-commons-test";
import { handleMessageV2 } from "../src/consumerServiceV2.js";
import {
  getPurposeStateFromPurposeVersions,
  readPlatformPurposeEntry,
  readTokenEntriesByPurposeId,
  writePlatformPurposeEntry,
} from "../src/utils.js";
import {
  config,
  writeAgreementEntry,
  writeTokenStateEntry,
  writeTokenStateEntryWithoutAgreement,
} from "./utils.js";

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

  describe("Events V2", async () => {
    describe("PurposeActivated", () => {
      it("no previous entry", async () => {
        const messageVersion = 1;
        const purpose: Purpose = {
          ...getMockPurpose(),
          versions: [getMockPurposeVersion(purposeVersionState.active)],
        };
        const purposeId = purpose.id;
        const purposeVersions = purpose.versions;
        const purposeState = getPurposeStateFromPurposeVersions(
          purpose.versions
        );
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
        const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
        const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
            GSIPK_purposeId: purposeId,
            purposeState: itemState.inactive,
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
          state: getPurposeStateFromPurposeVersions(purpose.versions),
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

      it("entry has to be updated: incoming has version 3; previous entry has version 2", async () => {
        const previousEntryVersion = 2;
        const messageVersion = 3;
        const purpose: Purpose = {
          ...getMockPurpose(),
          versions: [getMockPurposeVersion(purposeVersionState.active)],
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
          state: getPurposeStateFromPurposeVersions(purpose.versions),
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

      it("should update token-generation-states entries with agreement data from platform-states table", async () => {
        const messageVersion = 1;

        const purpose: Purpose = {
          ...getMockPurpose(),
          versions: [getMockPurposeVersion(purposeVersionState.active)],
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
        const mockAgreement = getMockAgreement(
          purpose.eserviceId,
          purpose.consumerId
        );
        const catalogAgreementEntryPK = makePlatformStatesAgreementPK(
          mockAgreement.id
        );
        const gsiPKConsumerIdEServiceId = makeGSIPKConsumerIdEServiceId({
          consumerId: mockAgreement.consumerId,
          eserviceId: mockAgreement.eserviceId,
        });
        const previousAgreementEntry: PlatformStatesAgreementEntry = {
          PK: catalogAgreementEntryPK,
          state: itemState.active,
          GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
          GSISK_agreementTimestamp: new Date().toISOString(),
          agreementDescriptorId: mockAgreement.descriptorId,
          version: 2,
          updatedAt: new Date().toISOString(),
        };
        await writeAgreementEntry(previousAgreementEntry, dynamoDBClient);

        // token-generation-states
        const purposeId = purpose.id;
        const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
        const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
            GSIPK_purposeId: purposeId,
            purposeState: itemState.inactive,
            GSIPK_consumerId_eserviceId: undefined,
            agreementId: undefined,
            agreementState: undefined,
            updatedAt: new Date().toISOString(),
          };
        await writeTokenStateEntryWithoutAgreement(
          dynamoDBClient,
          previousTokenStateEntry1
        );

        const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
        const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
            GSIPK_purposeId: purposeId,
            purposeState: itemState.inactive,
            GSIPK_consumerId_eserviceId: undefined,
            agreementId: undefined,
            agreementState: undefined,
            updatedAt: new Date().toISOString(),
          };
        await writeTokenStateEntryWithoutAgreement(
          dynamoDBClient,
          previousTokenStateEntry2
        );

        await handleMessageV2(message, dynamoDBClient);

        const retrievedTokenStateEntries = await readTokenEntriesByPurposeId(
          dynamoDBClient,
          purposeId
        );
        const expectedTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
          {
            ...previousTokenStateEntry1,
            purposeState: itemState.active,
            purposeVersionId: purposeVersions[0].id,
            GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
            agreementId: mockAgreement.id,
            agreementState: previousAgreementEntry.state,
          };
        const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
          {
            ...previousTokenStateEntry2,
            purposeState: itemState.active,
            purposeVersionId: purposeVersions[0].id,
            GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
            agreementId: mockAgreement.id,
            agreementState: previousAgreementEntry.state,
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
      it("no operation if the entry already exists: incoming has version 1; previous entry has version 2", async () => {
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
          suspendedByConsumer: true,
        };

        const payload: NewPurposeVersionActivatedV2 = {
          purpose: toPurposeV2(updatedPurpose),
          versionId: purposeVersions[0].id,
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

      it("entry has to be updated: incoming has version 3; previous entry has version 2", async () => {
        const previousEntryVersion = 2;
        const messageVersion = 3;

        const purposeVersions: PurposeVersion[] = [
          getMockPurposeVersion(purposeVersionState.active),
          getMockPurposeVersion(purposeVersionState.waitingForApproval),
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
        const messageVersion = 1;

        const purposeVersions: PurposeVersion[] = [
          getMockPurposeVersion(purposeVersionState.active),
          getMockPurposeVersion(purposeVersionState.waitingForApproval),
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
            purposeState: itemState.inactive,
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
    });

    describe("PurposeVersionActivated", async () => {
      it("no operation if the entry already exists: incoming has version 1; previous entry has version 2", async () => {
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
          suspendedByConsumer: true,
        };

        const payload: PurposeVersionActivatedV2 = {
          purpose: toPurposeV2(updatedPurpose),
          versionId: purposeVersions[0].id,
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionActivated",
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

      it("entry has to be updated: incoming has version 3; previous entry has version 2", async () => {
        const previousEntryVersion = 2;
        const messageVersion = 3;

        const purposeVersions: PurposeVersion[] = [
          getMockPurposeVersion(purposeVersionState.waitingForApproval),
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
              state: purposeVersionState.active,
              updatedAt: new Date(),
            },
          ],
        };

        const payload: PurposeVersionActivatedV2 = {
          purpose: toPurposeV2(updatedPurpose),
          versionId: purposeVersions[0].id,
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionActivated",
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

      it("should not throw error if entry doesn't exist", async () => {
        const messageVersion = 1;

        const purpose: Purpose = {
          ...getMockPurpose(),
          versions: [
            getMockPurposeVersion(purposeVersionState.waitingForApproval),
          ],
        };
        const purposeId = purpose.id;
        const purposeState = getPurposeStateFromPurposeVersions(
          purpose.versions
        );

        // platform-states
        const purposeEntryPrimaryKey = makePlatformStatesPurposePK(purposeId);
        const previousRetrievedPlatformPurposeEntry =
          await readPlatformPurposeEntry(
            dynamoDBClient,
            purposeEntryPrimaryKey
          );
        expect(previousRetrievedPlatformPurposeEntry).toBeUndefined();

        const updatedPurposeVersions: PurposeVersion[] = [
          {
            ...getMockPurposeVersion(purposeVersionState.active),
            updatedAt: new Date(),
          },
        ];

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
          versions: updatedPurposeVersions,
        };

        const payload: PurposeVersionActivatedV2 = {
          purpose: toPurposeV2(updatedPurpose),
          versionId: updatedPurposeVersions[0].id,
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionActivated",
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
    });

    describe("PurposeVersionSuspendedByConsumer", () => {
      it("no operation if the entry already exists: incoming has version 1; previous entry has version 2", async () => {
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
          suspendedByConsumer: true,
        };

        const payload: PurposeVersionSuspendedByConsumerV2 = {
          purpose: toPurposeV2(updatedPurpose),
          versionId: purposeVersions[0].id,
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionSuspendedByConsumer",
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

      it("entry has to be updated if the message version is more recent: suspendedByConsumer=true and suspendedByProducer=undefined", async () => {
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
          suspendedByConsumer: true,
        };

        const payload: PurposeVersionSuspendedByConsumerV2 = {
          purpose: toPurposeV2(updatedPurpose),
          versionId: purposeVersions[0].id,
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionSuspendedByConsumer",
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
          state: itemState.inactive,
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

      it("entry has to be updated if the message version is more recent: suspendedByConsumer=true and suspendedByProducer=true", async () => {
        const previousEntryVersion = 1;
        const messageVersion = 2;

        const purposeVersions: PurposeVersion[] = [
          getMockPurposeVersion(purposeVersionState.active),
        ];
        const purpose: Purpose = {
          ...getMockPurpose(),
          versions: purposeVersions,
          suspendedByProducer: true,
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
          suspendedByConsumer: true,
        };

        const payload: PurposeVersionSuspendedByConsumerV2 = {
          purpose: toPurposeV2(updatedPurpose),
          versionId: purposeVersions[0].id,
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionSuspendedByConsumer",
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
          state: itemState.inactive,
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

      it("should not throw error if entry doesn't exist", async () => {
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
          suspendedByConsumer: true,
        };

        const payload: PurposeVersionSuspendedByConsumerV2 = {
          purpose: toPurposeV2(updatedPurpose),
          versionId: updatedPurposeVersions[0].id,
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionSuspendedByConsumer",
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
    });

    describe("PurposeVersionSuspendedByProducer", () => {
      it("no operation if the entry already exists: incoming has version 1; previous entry has version 2", async () => {
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
          suspendedByProducer: true,
        };

        const payload: PurposeVersionSuspendedByProducerV2 = {
          purpose: toPurposeV2(updatedPurpose),
          versionId: purposeVersions[0].id,
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionSuspendedByProducer",
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

      it("entry has to be updated if the message version is more recent: suspendedByProducer=true and suspendedByConsumer=undefined", async () => {
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
          suspendedByProducer: true,
        };

        const payload: PurposeVersionSuspendedByProducerV2 = {
          purpose: toPurposeV2(updatedPurpose),
          versionId: purposeVersions[0].id,
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionSuspendedByProducer",
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
          state: itemState.inactive,
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

      it("entry has to be updated if the message version is more recent: suspendedByProducer=true and suspendedByConsumer=true", async () => {
        const previousEntryVersion = 1;
        const messageVersion = 2;

        const purposeVersions: PurposeVersion[] = [
          getMockPurposeVersion(purposeVersionState.active),
        ];
        const purpose: Purpose = {
          ...getMockPurpose(),
          versions: purposeVersions,
          suspendedByConsumer: true,
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
          suspendedByProducer: true,
        };

        const payload: PurposeVersionSuspendedByProducerV2 = {
          purpose: toPurposeV2(updatedPurpose),
          versionId: purposeVersions[0].id,
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionSuspendedByProducer",
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
          state: itemState.inactive,
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

      it("should not throw error if entry doesn't exist", async () => {
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
          suspendedByProducer: true,
        };

        const payload: PurposeVersionSuspendedByProducerV2 = {
          purpose: toPurposeV2(updatedPurpose),
          versionId: updatedPurposeVersions[0].id,
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionSuspendedByProducer",
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
    });

    describe("PurposeVersionUnsuspendedByConsumer", () => {
      it("no operation if the entry already exists: incoming has version 1; previous entry has version 2", async () => {
        const previousEntryVersion = 2;
        const messageVersion = 1;

        const purposeVersions: PurposeVersion[] = [
          getMockPurposeVersion(purposeVersionState.suspended),
        ];
        const purpose: Purpose = {
          ...getMockPurpose(),
          versions: purposeVersions,
          suspendedByConsumer: true,
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
              state: purposeVersionState.active,
              suspendedAt: undefined,
              updatedAt: new Date(),
            },
          ],
          suspendedByConsumer: false,
        };

        const payload: PurposeVersionUnsuspendedByConsumerV2 = {
          purpose: toPurposeV2(updatedPurpose),
          versionId: purposeVersions[0].id,
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionUnsuspendedByConsumer",
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

      it("entry has to be updated if the message version is more recent: suspendedByProducer=true and suspendedByConsumer=undefined", async () => {
        const previousEntryVersion = 1;
        const messageVersion = 2;

        const purposeVersions: PurposeVersion[] = [
          getMockPurposeVersion(purposeVersionState.suspended),
        ];
        const purpose: Purpose = {
          ...getMockPurpose(),
          versions: purposeVersions,
          suspendedByConsumer: true,
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
              state: purposeVersionState.active,
              suspendedAt: undefined,
              updatedAt: new Date(),
            },
          ],
          suspendedByConsumer: false,
        };

        const payload: PurposeVersionUnsuspendedByConsumerV2 = {
          purpose: toPurposeV2(updatedPurpose),
          versionId: purposeVersions[0].id,
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionUnsuspendedByConsumer",
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
            updatedAt: new Date().toISOString(),
          };
        const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
          {
            ...previousTokenStateEntry2,
            purposeState: itemState.active,
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

      it("entry has to be updated if the message version is more recent: suspendedByProducer=true and suspendedByConsumer=true", async () => {
        const previousEntryVersion = 1;
        const messageVersion = 2;

        const purposeVersions: PurposeVersion[] = [
          getMockPurposeVersion(purposeVersionState.suspended),
        ];
        const purpose: Purpose = {
          ...getMockPurpose(),
          versions: purposeVersions,
          suspendedByConsumer: true,
          suspendedByProducer: true,
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
              // TODO: not sure what the state becomes
              suspendedAt: undefined,
              updatedAt: new Date(),
            },
          ],
          suspendedByConsumer: false,
        };

        const payload: PurposeVersionUnsuspendedByConsumerV2 = {
          purpose: toPurposeV2(updatedPurpose),
          versionId: purposeVersions[0].id,
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionUnsuspendedByConsumer",
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
          state: itemState.inactive,
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

      it("should not throw error if entry doesn't exist", async () => {
        const messageVersion = 1;

        const purpose: Purpose = {
          ...getMockPurpose(),
          versions: [getMockPurposeVersion(purposeVersionState.suspended)],
          suspendedByConsumer: true,
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
            state: purposeVersionState.active,
            suspendedAt: undefined,
            updatedAt: new Date(),
          },
        ];

        const updatedPurpose: Purpose = {
          ...purpose,
          versions: updatedPurposeVersions,
          suspendedByConsumer: false,
        };

        const payload: PurposeVersionUnsuspendedByConsumerV2 = {
          purpose: toPurposeV2(updatedPurpose),
          versionId: updatedPurposeVersions[0].id,
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionUnsuspendedByConsumer",
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
    });

    describe("PurposeVersionUnsuspendedByProducer", () => {
      it("no operation if the entry already exists: incoming has version 1; previous entry has version 2", async () => {
        const previousEntryVersion = 2;
        const messageVersion = 1;

        const purposeVersions: PurposeVersion[] = [
          getMockPurposeVersion(purposeVersionState.suspended),
        ];
        const purpose: Purpose = {
          ...getMockPurpose(),
          versions: purposeVersions,
          suspendedByProducer: true,
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
              state: purposeVersionState.active,
              suspendedAt: undefined,
              updatedAt: new Date(),
            },
          ],
          suspendedByProducer: false,
        };

        const payload: PurposeVersionUnsuspendedByProducerV2 = {
          purpose: toPurposeV2(updatedPurpose),
          versionId: purposeVersions[0].id,
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionUnsuspendedByProducer",
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

      it("entry has to be updated if the message version is more recent: suspendedByProducer=true and suspendedByConsumer=undefined", async () => {
        const previousEntryVersion = 1;
        const messageVersion = 2;

        const purposeVersions: PurposeVersion[] = [
          getMockPurposeVersion(purposeVersionState.suspended),
        ];
        const purpose: Purpose = {
          ...getMockPurpose(),
          versions: purposeVersions,
          suspendedByProducer: true,
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
              state: purposeVersionState.active,
              suspendedAt: undefined,
              updatedAt: new Date(),
            },
          ],
          suspendedByProducer: false,
        };

        const payload: PurposeVersionUnsuspendedByProducerV2 = {
          purpose: toPurposeV2(updatedPurpose),
          versionId: purposeVersions[0].id,
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionUnsuspendedByProducer",
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
            updatedAt: new Date().toISOString(),
          };
        const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
          {
            ...previousTokenStateEntry2,
            purposeState: itemState.active,
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

      it("entry has to be updated if the message version is more recent: suspendedByProducer=true and suspendedByConsumer=true", async () => {
        const previousEntryVersion = 1;
        const messageVersion = 2;

        const purposeVersions: PurposeVersion[] = [
          getMockPurposeVersion(purposeVersionState.suspended),
        ];
        const purpose: Purpose = {
          ...getMockPurpose(),
          versions: purposeVersions,
          suspendedByConsumer: true,
          suspendedByProducer: true,
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
              // TODO: not sure what the state becomes
              suspendedAt: undefined,
              updatedAt: new Date(),
            },
          ],
          suspendedByProducer: false,
        };

        const payload: PurposeVersionUnsuspendedByProducerV2 = {
          purpose: toPurposeV2(updatedPurpose),
          versionId: purposeVersions[0].id,
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionUnsuspendedByProducer",
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
          state: itemState.inactive,
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

      it("should not throw error if entry doesn't exist", async () => {
        const messageVersion = 1;

        const purpose: Purpose = {
          ...getMockPurpose(),
          versions: [getMockPurposeVersion(purposeVersionState.suspended)],
          suspendedByProducer: true,
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
            state: purposeVersionState.active,
            suspendedAt: undefined,
            updatedAt: new Date(),
          },
        ];

        const updatedPurpose: Purpose = {
          ...purpose,
          versions: updatedPurposeVersions,
          suspendedByProducer: false,
        };

        const payload: PurposeVersionUnsuspendedByProducerV2 = {
          purpose: toPurposeV2(updatedPurpose),
          versionId: updatedPurposeVersions[0].id,
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionUnsuspendedByProducer",
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
    });

    it("PurposeArchived", async () => {
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
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);

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

      const payload: PurposeArchivedV2 = {
        purpose: toPurposeV2(updatedPurpose),
        versionId: purposeVersions[0].id,
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: purposeId,
        version: messageVersion,
        type: "PurposeArchived",
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
      expect(retrievedPlatformPurposeEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenStateEntries = await readTokenEntriesByPurposeId(
        dynamoDBClient,
        purposeId
      );
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
      // TODO: not sure about purposeState if archived. For now it remains active.
      expect(retrievedTokenStateEntries).toEqual(
        expect.arrayContaining([
          expectedTokenStateEntry1,
          expectedTokenStateEntry2,
        ])
      );
    });
  });
});
