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
  getMockAgreement,
  getMockDescriptor,
  getMockPurpose,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test";
import {
  generateId,
  itemState,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesAgreementPK,
  makePlatformStatesEServiceDescriptorPK,
  makePlatformStatesPurposePK,
  makeTokenGenerationStatesClientKidPurposePK,
  PlatformStatesAgreementEntry,
  PlatformStatesCatalogEntry,
  PlatformStatesPurposeEntry,
  Purpose,
  PurposeEventEnvelope,
  PurposeVersion,
  PurposeVersionActivatedV1,
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
import {
  config,
  toPurposeV1,
  writeAgreementEntry,
  writeCatalogEntry,
  writeTokenStateEntry,
} from "./utils.js";

describe("integration tests for consumerServiceV1", () => {
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

  describe("integration tests events V1", async () => {
    describe("PurposeVersionActivated", () => {
      it("should insert the entry if it does not exist", async () => {
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
        const payload: PurposeVersionActivatedV1 = {
          purpose: toPurposeV1(purpose),
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionActivated",
          event_version: 1,
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

        await handleMessageV1(message, dynamoDBClient);

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
        const retrievedTokenStateEntries =
          await readTokenEntriesByGSIPKPurposeId(dynamoDBClient, purposeId);
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

      it("should do no operation if the entry already exists and the message version is older", async () => {
        const previousEntryVersion = 2;
        const messageVersion = 1;
        const purpose: Purpose = {
          ...getMockPurpose(),
          versions: [getMockPurposeVersion(purposeVersionState.active)],
        };
        const payload: PurposeVersionActivatedV1 = {
          purpose: toPurposeV1(purpose),
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purpose.id,
          version: messageVersion,
          type: "PurposeVersionActivated",
          event_version: 1,
          data: payload,
          log_date: new Date(),
        };

        // platform-states
        const purposeEntryPrimaryKey = makePlatformStatesPurposePK(purpose.id);
        const previousPlatformPurposeEntry: PlatformStatesPurposeEntry = {
          PK: purposeEntryPrimaryKey,
          state: getPurposeStateFromPurposeVersions(purpose.versions),
          purposeVersionId: purpose.versions[0].id,
          purposeEserviceId: purpose.eserviceId,
          purposeConsumerId: purpose.consumerId,
          version: previousEntryVersion,
          updatedAt: mockDate.toISOString(),
        };
        await writePlatformPurposeEntry(
          dynamoDBClient,
          previousPlatformPurposeEntry
        );

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

        await handleMessageV1(message, dynamoDBClient);

        // platform-states
        const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
          dynamoDBClient,
          purposeEntryPrimaryKey
        );
        expect(retrievedPlatformPurposeEntry).toEqual(
          previousPlatformPurposeEntry
        );

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

      it("should update the entry if the message version is newer", async () => {
        const previousEntryVersion = 2;
        const messageVersion = 3;

        const lastPurposeVersionDate = mockDate;
        lastPurposeVersionDate.setDate(mockDate.getDate() + 1);
        const purposeVersions: PurposeVersion[] = [
          getMockPurposeVersion(purposeVersionState.active),
          {
            ...getMockPurposeVersion(purposeVersionState.waitingForApproval),
            createdAt: lastPurposeVersionDate,
          },
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
        const previousPlatformPurposeEntry: PlatformStatesPurposeEntry = {
          PK: purposeEntryPrimaryKey,
          state: purposeState,
          purposeVersionId: purposeVersions[0].id,
          purposeEserviceId: purpose.eserviceId,
          purposeConsumerId: purpose.consumerId,
          version: previousEntryVersion,
          updatedAt: mockDate.toISOString(),
        };
        await writePlatformPurposeEntry(
          dynamoDBClient,
          previousPlatformPurposeEntry
        );

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

        const payload: PurposeVersionActivatedV1 = {
          purpose: toPurposeV1(updatedPurpose),
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionActivated",
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
          ...previousPlatformPurposeEntry,
          state: itemState.active,
          purposeVersionId: purposeVersions[1].id,
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

      it("should set the entry state to active if the message version is newer and the state is suspended", async () => {
        const previousEntryVersion = 1;
        const messageVersion = 2;

        const lastPurposeVersionDate = mockDate;
        lastPurposeVersionDate.setDate(mockDate.getDate() + 1);
        const purposeVersions: PurposeVersion[] = [
          getMockPurposeVersion(purposeVersionState.archived),
          {
            ...getMockPurposeVersion(purposeVersionState.suspended),
            createdAt: lastPurposeVersionDate,
          },
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
          purposeVersionId: purposeVersions[1].id,
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
            purposeVersionId: purposeVersions[1].id,
          };
        await writeTokenStateEntry(dynamoDBClient, previousTokenStateEntry1);

        const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(),
            GSIPK_purposeId: purposeId,
            purposeState,
            purposeVersionId: purposeVersions[1].id,
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
        };

        const payload: PurposeVersionActivatedV1 = {
          purpose: toPurposeV1(updatedPurpose),
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purposeId,
          version: messageVersion,
          type: "PurposeVersionActivated",
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
          state: itemState.active,
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

      it("should update token-generation-states entries with the corresponding agreement and descriptor data from platform-states table", async () => {
        const messageVersion = 1;

        const purpose: Purpose = {
          ...getMockPurpose(),
          versions: [getMockPurposeVersion(purposeVersionState.active)],
        };
        const purposeVersions = purpose.versions;
        const payload: PurposeVersionActivatedV1 = {
          purpose: toPurposeV1(purpose),
        };
        const message: PurposeEventEnvelope = {
          sequence_num: 1,
          stream_id: purpose.id,
          version: messageVersion,
          type: "PurposeVersionActivated",
          event_version: 1,
          data: payload,
          log_date: new Date(),
        };

        // platform-states
        const mockDescriptor = getMockDescriptor();
        const mockAgreement = {
          ...getMockAgreement(purpose.eserviceId, purpose.consumerId),
          descriptorId: mockDescriptor.id,
        };
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

        const catalogEntryPK = makePlatformStatesEServiceDescriptorPK({
          eserviceId: purpose.eserviceId,
          descriptorId: mockDescriptor.id,
        });
        const previousDescriptorEntry: PlatformStatesCatalogEntry = {
          PK: catalogEntryPK,
          state: itemState.active,
          descriptorAudience: ["pagopa.it"],
          descriptorVoucherLifespan: mockDescriptor.voucherLifespan,
          version: 2,
          updatedAt: new Date().toISOString(),
        };
        await writeCatalogEntry(dynamoDBClient, previousDescriptorEntry);

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
            GSIPK_eserviceId_descriptorId: undefined,
            descriptorState: undefined,
            descriptorAudience: undefined,
            descriptorVoucherLifespan: undefined,
            updatedAt: new Date().toISOString(),
          };
        await writeTokenStateEntry(dynamoDBClient, previousTokenStateEntry1);

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
            GSIPK_eserviceId_descriptorId: undefined,
            descriptorState: undefined,
            descriptorAudience: undefined,
            descriptorVoucherLifespan: undefined,
            updatedAt: new Date().toISOString(),
          };
        await writeTokenStateEntry(dynamoDBClient, previousTokenStateEntry2);

        await handleMessageV1(message, dynamoDBClient);

        const retrievedTokenStateEntries =
          await readTokenEntriesByGSIPKPurposeId(dynamoDBClient, purposeId);
        const gsiPKEserviceIdDescriptorId = makeGSIPKEServiceIdDescriptorId({
          eserviceId: purpose.eserviceId,
          descriptorId: mockDescriptor.id,
        });
        const expectedTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
          {
            ...previousTokenStateEntry1,
            purposeState: itemState.active,
            purposeVersionId: purposeVersions[0].id,
            GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
            agreementId: mockAgreement.id,
            agreementState: previousAgreementEntry.state,
            GSIPK_eserviceId_descriptorId: gsiPKEserviceIdDescriptorId,
            descriptorState: previousDescriptorEntry.state,
            descriptorAudience: previousDescriptorEntry.descriptorAudience,
            descriptorVoucherLifespan:
              previousDescriptorEntry.descriptorVoucherLifespan,
          };
        const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
          {
            ...previousTokenStateEntry2,
            purposeState: itemState.active,
            purposeVersionId: purposeVersions[0].id,
            GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
            agreementId: mockAgreement.id,
            agreementState: previousAgreementEntry.state,
            GSIPK_eserviceId_descriptorId: gsiPKEserviceIdDescriptorId,
            descriptorState: previousDescriptorEntry.state,
            descriptorAudience: previousDescriptorEntry.descriptorAudience,
            descriptorVoucherLifespan:
              previousDescriptorEntry.descriptorVoucherLifespan,
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
        const previousPlatformPurposeEntry: PlatformStatesPurposeEntry = {
          PK: purposeEntryPrimaryKey,
          state: purposeState,
          purposeVersionId: purposeVersions[0].id,
          purposeEserviceId: purpose.eserviceId,
          purposeConsumerId: purpose.consumerId,
          version: previousEntryVersion,
          updatedAt: mockDate.toISOString(),
        };
        await writePlatformPurposeEntry(
          dynamoDBClient,
          previousPlatformPurposeEntry
        );

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
        expect(retrievedPlatformPurposeEntry).toEqual(
          previousPlatformPurposeEntry
        );

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
      it("should update the entry if the message version is newer", async () => {
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
        const previousPlatformPurposeEntry: PlatformStatesPurposeEntry = {
          PK: purposeEntryPrimaryKey,
          state: purposeState,
          purposeVersionId: purposeVersions[0].id,
          purposeEserviceId: purpose.eserviceId,
          purposeConsumerId: purpose.consumerId,
          version: previousEntryVersion,
          updatedAt: mockDate.toISOString(),
        };
        await writePlatformPurposeEntry(
          dynamoDBClient,
          previousPlatformPurposeEntry
        );

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
          ...previousPlatformPurposeEntry,
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

      // TODO: is this case needed?
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
        const previousPlatformPurposeEntry: PlatformStatesPurposeEntry = {
          PK: purposeEntryPrimaryKey,
          state: purposeState,
          purposeVersionId: purposeVersions[0].id,
          purposeEserviceId: purpose.eserviceId,
          purposeConsumerId: purpose.consumerId,
          version: previousEntryVersion,
          updatedAt: mockDate.toISOString(),
        };
        await writePlatformPurposeEntry(
          dynamoDBClient,
          previousPlatformPurposeEntry
        );

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
