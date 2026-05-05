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
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockAgreement,
  getMockDescriptor,
  getMockPurpose,
  getMockPurposeVersion,
  readAllTokenGenStatesItems,
  writePlatformAgreementEntry,
  writePlatformCatalogEntry,
  writePlatformPurposeEntry,
  writeTokenGenStatesConsumerClient,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  generateId,
  itemState,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesAgreementPK,
  makePlatformStatesEServiceDescriptorPK,
  makePlatformStatesPurposePK,
  makeTokenGenerationStatesClientKidPurposePK,
  NewPurposeVersionActivatedV2,
  PlatformStatesAgreementEntry,
  PlatformStatesCatalogEntry,
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
  TokenGenerationStatesConsumerClient,
  toPurposeV2,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { getMockTokenGenStatesConsumerClient } from "pagopa-interop-commons-test";
import { handleMessageV2 } from "../src/consumerServiceV2.js";
import {
  getPurposeStateFromPurposeVersions,
  readPlatformPurposeEntry,
} from "../src/utils.js";
import { dynamoDBClient } from "./utils.js";

describe("integration tests for events V2", () => {
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

  describe("PurposeActivated", () => {
    it("should insert the entry in platform states and do no operation in token-generation-states", async () => {
      const messageVersion = 1;

      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion(purposeVersionState.active)],
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
      expect(
        await readPlatformPurposeEntry(dynamoDBClient, purposeEntryPrimaryKey)
      ).toBeUndefined();

      // token-generation-states
      expect(await readAllTokenGenStatesItems(dynamoDBClient)).toHaveLength(0);

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      const expectedPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        PK: purposeEntryPrimaryKey,
        state: itemState.active,
        purposeVersionId: purpose.versions[0].id,
        purposeEserviceId: purpose.eserviceId,
        purposeConsumerId: purpose.consumerId,
        version: messageVersion,
        updatedAt: mockDate.toISOString(),
      };
      expect(retrievedPlatformPurposeEntry).toEqual(
        expectedPlatformPurposeEntry
      );

      // token-generation-states
      expect(await readAllTokenGenStatesItems(dynamoDBClient)).toHaveLength(0);
    });

    it("should insert the entry in platform states if it doesn't exist and update token generation states", async () => {
      const messageVersion = 1;
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const purposeId = purpose.id;
      const purposeVersions = purpose.versions;
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);
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
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          GSIPK_consumerId_eserviceId: undefined,
          GSIPK_eserviceId_descriptorId: undefined,
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          GSIPK_consumerId_eserviceId: undefined,
          GSIPK_eserviceId_descriptorId: undefined,
          GSIPK_purposeId: purposeId,
          purposeState,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

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

      // token-generation-states
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: purpose.consumerId,
        eserviceId: purpose.eserviceId,
      });
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          consumerId: purpose.consumerId,
          GSIPK_consumerId_eserviceId,
          purposeState: itemState.active,
          purposeVersionId: purposeVersions[0].id,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          consumerId: purpose.consumerId,
          GSIPK_consumerId_eserviceId,
          purposeState: itemState.active,
          purposeVersionId: purposeVersions[0].id,
          updatedAt: new Date().toISOString(),
        };
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });

    it("should do no operation if the existing table entry is more recent", async () => {
      const previousEntryVersion = 2;
      const messageVersion = 1;
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion(purposeVersionState.active)],
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
        previousPlatformPurposeEntry,
        dynamoDBClient
      );

      // token-generation-states
      const purposeId = purpose.id;
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      expect(retrievedPlatformPurposeEntry).toEqual(
        previousPlatformPurposeEntry
      );

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient1,
          tokenGenStatesConsumerClient2,
        ])
      );
    });

    it("should update the entry when incoming version is more recent than existing table entry", async () => {
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
      const previousPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        PK: purposeEntryPrimaryKey,
        state: getPurposeStateFromPurposeVersions(purpose.versions),
        purposeVersionId: purposeVersions[0].id,
        purposeEserviceId: purpose.eserviceId,
        purposeConsumerId: purpose.consumerId,
        version: previousEntryVersion,
        updatedAt: mockDate.toISOString(),
      };
      await writePlatformPurposeEntry(
        previousPlatformPurposeEntry,
        dynamoDBClient
      );

      // token-generation-states
      const purposeId = purpose.id;
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_consumerId_eserviceId: undefined,
          GSIPK_eserviceId_descriptorId: undefined,
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_consumerId_eserviceId: undefined,
          GSIPK_eserviceId_descriptorId: undefined,
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      const expectedPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        ...previousPlatformPurposeEntry,
        state: itemState.active,
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformPurposeEntry).toEqual(
        expectedPlatformPurposeEntry
      );

      // token-generation-states
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: purpose.consumerId,
        eserviceId: purpose.eserviceId,
      });
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          consumerId: purpose.consumerId,
          GSIPK_consumerId_eserviceId,
          purposeState: itemState.active,
          purposeVersionId: purposeVersions[0].id,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          consumerId: purpose.consumerId,
          GSIPK_consumerId_eserviceId,
          purposeState: itemState.active,
          purposeVersionId: purposeVersions[0].id,
          updatedAt: new Date().toISOString(),
        };
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });

    it("should update the token generation states entries with the corresponding agreement and descriptor data from platform states", async () => {
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
      const mockDescriptor = getMockDescriptor();
      const mockAgreement: Agreement = {
        ...getMockAgreement(purpose.eserviceId, purpose.consumerId),
        descriptorId: mockDescriptor.id,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const catalogAgreementEntryPK = makePlatformStatesAgreementPK({
        consumerId: purpose.consumerId,
        eserviceId: purpose.eserviceId,
      });
      const gsiPKConsumerIdEServiceId = makeGSIPKConsumerIdEServiceId({
        consumerId: mockAgreement.consumerId,
        eserviceId: mockAgreement.eserviceId,
      });
      const platformStatesAgreementEntry: PlatformStatesAgreementEntry = {
        PK: catalogAgreementEntryPK,
        state: itemState.active,
        agreementId: mockAgreement.id,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        agreementTimestamp: mockAgreement.stamps.activation!.when.toISOString(),
        agreementDescriptorId: mockAgreement.descriptorId,
        producerId: mockAgreement.producerId,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformAgreementEntry(
        platformStatesAgreementEntry,
        dynamoDBClient
      );

      const catalogEntryPK = makePlatformStatesEServiceDescriptorPK({
        eserviceId: purpose.eserviceId,
        descriptorId: mockDescriptor.id,
      });
      const platformStatesDescriptorEntry: PlatformStatesCatalogEntry = {
        PK: catalogEntryPK,
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: mockDescriptor.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(
        platformStatesDescriptorEntry,
        dynamoDBClient
      );

      // token-generation-states
      const purposeId = purpose.id;
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          consumerId: purpose.consumerId,
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
          GSIPK_consumerId_eserviceId: undefined,
          agreementId: undefined,
          agreementState: undefined,
          producerId: undefined,
          GSIPK_eserviceId_descriptorId: undefined,
          descriptorState: undefined,
          descriptorAudience: undefined,
          descriptorVoucherLifespan: undefined,
          updatedAt: new Date().toISOString(),
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          consumerId: purpose.consumerId,
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
          GSIPK_consumerId_eserviceId: undefined,
          agreementId: undefined,
          agreementState: undefined,
          producerId: undefined,
          GSIPK_eserviceId_descriptorId: undefined,
          descriptorState: undefined,
          descriptorAudience: undefined,
          descriptorVoucherLifespan: undefined,
          updatedAt: new Date().toISOString(),
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const gsiPKEserviceIdDescriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: purpose.eserviceId,
        descriptorId: mockDescriptor.id,
      });
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          purposeState: itemState.active,
          purposeVersionId: purposeVersions[0].id,
          GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
          agreementId: mockAgreement.id,
          agreementState: platformStatesAgreementEntry.state,
          producerId: platformStatesAgreementEntry.producerId,
          GSIPK_eserviceId_descriptorId: gsiPKEserviceIdDescriptorId,
          descriptorState: platformStatesDescriptorEntry.state,
          descriptorAudience: platformStatesDescriptorEntry.descriptorAudience,
          descriptorVoucherLifespan:
            platformStatesDescriptorEntry.descriptorVoucherLifespan,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          purposeState: itemState.active,
          purposeVersionId: purposeVersions[0].id,
          GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
          agreementId: mockAgreement.id,
          agreementState: platformStatesAgreementEntry.state,
          producerId: platformStatesAgreementEntry.producerId,
          GSIPK_eserviceId_descriptorId: gsiPKEserviceIdDescriptorId,
          descriptorState: platformStatesDescriptorEntry.state,
          descriptorAudience: platformStatesDescriptorEntry.descriptorAudience,
          descriptorVoucherLifespan:
            platformStatesDescriptorEntry.descriptorVoucherLifespan,
          updatedAt: new Date().toISOString(),
        };
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });
  });

  describe("NewPurposeVersionActivated", async () => {
    it("should do no operation if the existing table entry is more recent", async () => {
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
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);

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
        previousPlatformPurposeEntry,
        dynamoDBClient
      );

      // token-generation-states
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

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

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      expect(retrievedPlatformPurposeEntry).toEqual(
        previousPlatformPurposeEntry
      );

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient1,
          tokenGenStatesConsumerClient2,
        ])
      );
    });

    it("should update the entry when incoming version is more recent than existing table entry", async () => {
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
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);

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
        previousPlatformPurposeEntry,
        dynamoDBClient
      );

      // token-generation-states
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

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

      await handleMessageV2(message, dynamoDBClient, genericLogger);

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
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          consumerId: purpose.consumerId,
          purposeState: itemState.active,
          purposeVersionId: purposeVersions[1].id,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          consumerId: purpose.consumerId,
          purposeState: itemState.active,
          purposeVersionId: purposeVersions[1].id,
          updatedAt: new Date().toISOString(),
        };
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });
  });

  describe("PurposeVersionActivated", async () => {
    it("should insert the entry in platform states and do no operation in token-generation-states", async () => {
      const messageVersion = 1;

      const purposeVersions: PurposeVersion[] = [
        getMockPurposeVersion(purposeVersionState.active),
      ];
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: purposeVersions,
      };
      const payload: PurposeVersionActivatedV2 = {
        purpose: toPurposeV2(purpose),
        versionId: purposeVersions[0].id,
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: purpose.id,
        version: messageVersion,
        type: "PurposeVersionActivated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const purposeEntryPrimaryKey = makePlatformStatesPurposePK(purpose.id);
      expect(
        await readPlatformPurposeEntry(dynamoDBClient, purposeEntryPrimaryKey)
      ).toBeUndefined();

      // token-generation-states
      expect(await readAllTokenGenStatesItems(dynamoDBClient)).toHaveLength(0);

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      const expectedPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        PK: purposeEntryPrimaryKey,
        state: itemState.active,
        purposeVersionId: purpose.versions[0].id,
        purposeEserviceId: purpose.eserviceId,
        purposeConsumerId: purpose.consumerId,
        version: messageVersion,
        updatedAt: mockDate.toISOString(),
      };
      expect(retrievedPlatformPurposeEntry).toEqual(
        expectedPlatformPurposeEntry
      );

      // token-generation-states
      expect(await readAllTokenGenStatesItems(dynamoDBClient)).toHaveLength(0);
    });

    it("should insert the entry in platform states if it doesn't exist and update token generation states", async () => {
      const messageVersion = 1;
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const purposeId = purpose.id;
      const purposeVersions = purpose.versions;
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);
      const payload: PurposeVersionActivatedV2 = {
        purpose: toPurposeV2(purpose),
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

      // platform-states
      const purposeEntryPrimaryKey = makePlatformStatesPurposePK(purposeId);
      const previousPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      expect(previousPlatformPurposeEntry).toBeUndefined();

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          GSIPK_consumerId_eserviceId: undefined,
          GSIPK_eserviceId_descriptorId: undefined,
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          GSIPK_consumerId_eserviceId: undefined,
          GSIPK_eserviceId_descriptorId: undefined,
          GSIPK_purposeId: purposeId,
          purposeState,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

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

      // token-generation-states
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: purpose.consumerId,
        eserviceId: purpose.eserviceId,
      });
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          consumerId: purpose.consumerId,
          GSIPK_consumerId_eserviceId,
          purposeState: itemState.active,
          purposeVersionId: purposeVersions[0].id,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          consumerId: purpose.consumerId,
          GSIPK_consumerId_eserviceId,
          purposeState: itemState.active,
          purposeVersionId: purposeVersions[0].id,
          updatedAt: new Date().toISOString(),
        };
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });

    it("should do no operation if the existing table entry is more recent", async () => {
      const previousEntryVersion = 2;
      const messageVersion = 1;
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const payload: PurposeVersionActivatedV2 = {
        purpose: toPurposeV2(purpose),
        versionId: purpose.versions[0].id,
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: purpose.id,
        version: messageVersion,
        type: "PurposeVersionActivated",
        event_version: 2,
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
        previousPlatformPurposeEntry,
        dynamoDBClient
      );

      // token-generation-states
      const purposeId = purpose.id;
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      expect(retrievedPlatformPurposeEntry).toEqual(
        previousPlatformPurposeEntry
      );

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient1,
          tokenGenStatesConsumerClient2,
        ])
      );
    });

    it("should update the entry when incoming version is more recent than existing table entry", async () => {
      const previousEntryVersion = 2;
      const messageVersion = 3;

      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const purposeVersions = purpose.versions;
      const payload: PurposeVersionActivatedV2 = {
        purpose: toPurposeV2(purpose),
        versionId: purposeVersions[0].id,
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: purpose.id,
        version: messageVersion,
        type: "PurposeVersionActivated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const purposeEntryPrimaryKey = makePlatformStatesPurposePK(purpose.id);
      const previousPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        PK: purposeEntryPrimaryKey,
        state: getPurposeStateFromPurposeVersions(purpose.versions),
        purposeVersionId: purposeVersions[0].id,
        purposeEserviceId: purpose.eserviceId,
        purposeConsumerId: purpose.consumerId,
        version: previousEntryVersion,
        updatedAt: mockDate.toISOString(),
      };
      await writePlatformPurposeEntry(
        previousPlatformPurposeEntry,
        dynamoDBClient
      );

      // token-generation-states
      const purposeId = purpose.id;
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_consumerId_eserviceId: undefined,
          GSIPK_eserviceId_descriptorId: undefined,
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_consumerId_eserviceId: undefined,
          GSIPK_eserviceId_descriptorId: undefined,
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      const expectedPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        ...previousPlatformPurposeEntry,
        state: itemState.active,
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformPurposeEntry).toEqual(
        expectedPlatformPurposeEntry
      );

      // token-generation-states
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: purpose.consumerId,
        eserviceId: purpose.eserviceId,
      });
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          consumerId: purpose.consumerId,
          GSIPK_consumerId_eserviceId,
          purposeState: itemState.active,
          purposeVersionId: purposeVersions[0].id,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          consumerId: purpose.consumerId,
          GSIPK_consumerId_eserviceId,
          purposeState: itemState.active,
          purposeVersionId: purposeVersions[0].id,
          updatedAt: new Date().toISOString(),
        };
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });

    it("should update the token generation states entries with the corresponding agreement and descriptor data from platform states", async () => {
      const messageVersion = 1;

      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const purposeVersions = purpose.versions;
      const payload: PurposeVersionActivatedV2 = {
        purpose: toPurposeV2(purpose),
        versionId: purposeVersions[0].id,
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: purpose.id,
        version: messageVersion,
        type: "PurposeVersionActivated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const mockDescriptor = getMockDescriptor();
      const mockAgreement: Agreement = {
        ...getMockAgreement(purpose.eserviceId, purpose.consumerId),
        descriptorId: mockDescriptor.id,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const catalogAgreementEntryPK = makePlatformStatesAgreementPK({
        consumerId: purpose.consumerId,
        eserviceId: purpose.eserviceId,
      });
      const gsiPKConsumerIdEServiceId = makeGSIPKConsumerIdEServiceId({
        consumerId: mockAgreement.consumerId,
        eserviceId: mockAgreement.eserviceId,
      });
      const platformStatesAgreementEntry: PlatformStatesAgreementEntry = {
        PK: catalogAgreementEntryPK,
        state: itemState.active,
        agreementId: mockAgreement.id,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        agreementTimestamp: mockAgreement.stamps.activation!.when.toISOString(),
        agreementDescriptorId: mockAgreement.descriptorId,
        producerId: mockAgreement.producerId,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformAgreementEntry(
        platformStatesAgreementEntry,
        dynamoDBClient
      );

      const catalogEntryPK = makePlatformStatesEServiceDescriptorPK({
        eserviceId: purpose.eserviceId,
        descriptorId: mockDescriptor.id,
      });
      const platformStatesDescriptorEntry: PlatformStatesCatalogEntry = {
        PK: catalogEntryPK,
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: mockDescriptor.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(
        platformStatesDescriptorEntry,
        dynamoDBClient
      );

      // token-generation-states
      const purposeId = purpose.id;
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
          GSIPK_consumerId_eserviceId: undefined,
          agreementId: undefined,
          agreementState: undefined,
          producerId: undefined,
          GSIPK_eserviceId_descriptorId: undefined,
          descriptorState: undefined,
          descriptorAudience: undefined,
          descriptorVoucherLifespan: undefined,
          updatedAt: new Date().toISOString(),
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
          GSIPK_consumerId_eserviceId: undefined,
          agreementId: undefined,
          agreementState: undefined,
          producerId: undefined,
          GSIPK_eserviceId_descriptorId: undefined,
          descriptorState: undefined,
          descriptorAudience: undefined,
          descriptorVoucherLifespan: undefined,
          updatedAt: new Date().toISOString(),
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const gsiPKEserviceIdDescriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: purpose.eserviceId,
        descriptorId: mockDescriptor.id,
      });
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          consumerId: purpose.consumerId,
          purposeState: itemState.active,
          purposeVersionId: purposeVersions[0].id,
          GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
          agreementId: mockAgreement.id,
          agreementState: platformStatesAgreementEntry.state,
          producerId: platformStatesAgreementEntry.producerId,
          GSIPK_eserviceId_descriptorId: gsiPKEserviceIdDescriptorId,
          descriptorState: platformStatesDescriptorEntry.state,
          descriptorAudience: platformStatesDescriptorEntry.descriptorAudience,
          descriptorVoucherLifespan:
            platformStatesDescriptorEntry.descriptorVoucherLifespan,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          consumerId: purpose.consumerId,
          purposeState: itemState.active,
          purposeVersionId: purposeVersions[0].id,
          GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
          agreementId: mockAgreement.id,
          agreementState: platformStatesAgreementEntry.state,
          producerId: platformStatesAgreementEntry.producerId,
          GSIPK_eserviceId_descriptorId: gsiPKEserviceIdDescriptorId,
          descriptorState: platformStatesDescriptorEntry.state,
          descriptorAudience: platformStatesDescriptorEntry.descriptorAudience,
          descriptorVoucherLifespan:
            platformStatesDescriptorEntry.descriptorVoucherLifespan,
          updatedAt: new Date().toISOString(),
        };
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });
  });

  describe("PurposeVersionSuspendedByConsumer", () => {
    it("should do no operation if the existing table entry is more recent", async () => {
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
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);

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
        previousPlatformPurposeEntry,
        dynamoDBClient
      );

      // token-generation-states
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

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

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      expect(retrievedPlatformPurposeEntry).toEqual(
        previousPlatformPurposeEntry
      );

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient1,
          tokenGenStatesConsumerClient2,
        ])
      );
    });

    it("should update the entry if the message version is more recent and the purpose is suspended by the consumer", async () => {
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
        previousPlatformPurposeEntry,
        dynamoDBClient
      );

      // token-generation-states
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

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

      await handleMessageV2(message, dynamoDBClient, genericLogger);

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
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          consumerId: purpose.consumerId,
          purposeState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          consumerId: purpose.consumerId,
          purposeState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });

    it("should update the entry if the message version is more recent and the purpose is suspended by the consumer and suspended by the producer", async () => {
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
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);

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
        previousPlatformPurposeEntry,
        dynamoDBClient
      );

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      const updatedPurpose: Purpose = {
        ...purpose,
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

      await handleMessageV2(message, dynamoDBClient, genericLogger);

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
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          consumerId: purpose.consumerId,
          purposeState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          consumerId: purpose.consumerId,
          purposeState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });
  });

  describe("PurposeVersionSuspendedByProducer", () => {
    it("should do no operation if the existing table entry is more recent", async () => {
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
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);

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
        previousPlatformPurposeEntry,
        dynamoDBClient
      );

      // token-generation-states
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

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

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      expect(retrievedPlatformPurposeEntry).toEqual(
        previousPlatformPurposeEntry
      );

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient1,
          tokenGenStatesConsumerClient2,
        ])
      );
    });

    it("should update the entry if the message version is more recent and the purpose is suspended by the producer", async () => {
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
        previousPlatformPurposeEntry,
        dynamoDBClient
      );

      // token-generation-states
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

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

      await handleMessageV2(message, dynamoDBClient, genericLogger);

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
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          consumerId: purpose.consumerId,
          purposeState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          consumerId: purpose.consumerId,
          purposeState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });

    it("should update the entry if the message version is more recent and the purpose is suspended by the producer and suspended by the consumer", async () => {
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
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);

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
        previousPlatformPurposeEntry,
        dynamoDBClient
      );

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      const updatedPurpose: Purpose = {
        ...purpose,
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

      await handleMessageV2(message, dynamoDBClient, genericLogger);

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
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          consumerId: purpose.consumerId,
          purposeState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          consumerId: purpose.consumerId,
          purposeState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });
  });

  describe("PurposeVersionUnsuspendedByConsumer", () => {
    it("should do no operation if the existing table entry is more recent", async () => {
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
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);

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
        previousPlatformPurposeEntry,
        dynamoDBClient
      );

      // token-generation-states
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

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

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      expect(retrievedPlatformPurposeEntry).toEqual(
        previousPlatformPurposeEntry
      );

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient1,
          tokenGenStatesConsumerClient2,
        ])
      );
    });

    it("should update the entry if the message version is more recent and the purpose is unsuspended by the consumer", async () => {
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
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);

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
        previousPlatformPurposeEntry,
        dynamoDBClient
      );

      // token-generation-states
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

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

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      const expectedPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        ...previousPlatformPurposeEntry,
        state: itemState.active,
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformPurposeEntry).toEqual(
        expectedPlatformPurposeEntry
      );

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          consumerId: purpose.consumerId,
          purposeState: itemState.active,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          consumerId: purpose.consumerId,
          purposeState: itemState.active,
          updatedAt: new Date().toISOString(),
        };
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });

    it("should update the entry if the message version is more recent and the purpose is unsuspended by the consumer and suspended by the producer", async () => {
      const previousEntryVersion = 1;
      const messageVersion = 2;

      const purposeVersions: PurposeVersion[] = [
        getMockPurposeVersion(purposeVersionState.suspended),
      ];
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: purposeVersions,
        suspendedByProducer: true,
        suspendedByConsumer: true,
      };
      const purposeId = purpose.id;
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);

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
        previousPlatformPurposeEntry,
        dynamoDBClient
      );

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      const updatedPurpose: Purpose = {
        ...purpose,
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

      await handleMessageV2(message, dynamoDBClient, genericLogger);

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
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          consumerId: purpose.consumerId,
          purposeState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          consumerId: purpose.consumerId,
          purposeState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });
  });

  describe("PurposeVersionUnsuspendedByProducer", () => {
    it("should do no operation if the existing table entry is more recent", async () => {
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
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);

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
        previousPlatformPurposeEntry,
        dynamoDBClient
      );

      // token-generation-states
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

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

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      expect(retrievedPlatformPurposeEntry).toEqual(
        previousPlatformPurposeEntry
      );

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient1,
          tokenGenStatesConsumerClient2,
        ])
      );
    });

    it("should update the entry if the message version is more recent and the purpose is unsuspended by the producer", async () => {
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
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);

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
        previousPlatformPurposeEntry,
        dynamoDBClient
      );

      // token-generation-states
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

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

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      const expectedPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        ...previousPlatformPurposeEntry,
        state: itemState.active,
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformPurposeEntry).toEqual(
        expectedPlatformPurposeEntry
      );

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          consumerId: purpose.consumerId,
          purposeState: itemState.active,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          consumerId: purpose.consumerId,
          purposeState: itemState.active,
          updatedAt: new Date().toISOString(),
        };
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });

    it("should update the entry if the message version is more recent and the purpose is unsuspended by the producer and suspended by the consumer", async () => {
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
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);

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
        previousPlatformPurposeEntry,
        dynamoDBClient
      );

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          GSIPK_purposeId: purposeId,
          purposeState,
          purposeVersionId: purposeVersions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      const updatedPurpose: Purpose = {
        ...purpose,
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

      await handleMessageV2(message, dynamoDBClient, genericLogger);

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
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          consumerId: purpose.consumerId,
          purposeState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          consumerId: purpose.consumerId,
          purposeState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });
  });

  describe("PurposeArchived", () => {
    it("should delete the entry from platform states and update token generation states", async () => {
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
        previousPlatformPurposeEntry,
        dynamoDBClient
      );

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          GSIPK_purposeId: purposeId,
          purposeVersionId: purposeVersions[0].id,
          purposeState,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          GSIPK_purposeId: purposeId,
          purposeVersionId: purposeVersions[0].id,
          purposeState,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

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

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      expect(retrievedPlatformPurposeEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          consumerId: purpose.consumerId,
          purposeState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          consumerId: purpose.consumerId,
          purposeState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });
  });
});
