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
  TokenGenerationStatesConsumerClient,
} from "pagopa-interop-models";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockTokenGenStatesConsumerClient,
  toPurposeV1,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import { handleMessageV1 } from "../src/consumerServiceV1.js";
import {
  getPurposeStateFromPurposeVersions,
  readPlatformPurposeEntry,
} from "../src/utils.js";
import { dynamoDBClient } from "./utils.js";

describe("integration tests for events V1", () => {
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

  describe("PurposeVersionActivated", () => {
    it("should insert the entry in platform states and do no operation in token-generation-states", async () => {
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
      expect(
        await readPlatformPurposeEntry(dynamoDBClient, purposeEntryPrimaryKey)
      ).toBeUndefined();

      // token-generation-states
      expect(await readAllTokenGenStatesItems(dynamoDBClient)).toHaveLength(0);

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      const expectedPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        PK: purposeEntryPrimaryKey,
        state: getPurposeStateFromPurposeVersions(purpose.versions),
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
          GSIPK_consumerId_eserviceId: undefined,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

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

      // token-generation-states
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: purpose.consumerId,
        eserviceId: purpose.eserviceId,
      });
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
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

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      expect(retrievedPlatformPurposeEntry).toEqual(
        previousPlatformPurposeEntry
      );

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient1,
          tokenGenStatesConsumerClient2,
        ])
      );
    });

    it("should update the platform-states entry when the incoming version is more recent or equal than the existing table entry", async () => {
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

      await handleMessageV1(message, dynamoDBClient, genericLogger);

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
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      const gsiPKConsumerIdEServiceId = makeGSIPKConsumerIdEServiceId({
        consumerId: purpose.consumerId,
        eserviceId: purpose.eserviceId,
      });

      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
          consumerId: purpose.consumerId,
          purposeState: itemState.active,
          purposeVersionId: purposeVersions[1].id,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
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

    it("should update the token generation states entries with the corresponding agreement and descriptor data from platform states", async () => {
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

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
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

  describe("PurposeVersionSuspended", () => {
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

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      expect(retrievedPlatformPurposeEntry).toEqual(
        previousPlatformPurposeEntry
      );

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient1,
          tokenGenStatesConsumerClient2,
        ])
      );
    });

    it("should update the entry when incoming version is more recent than existing table entry", async () => {
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

      await handleMessageV1(message, dynamoDBClient, genericLogger);

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
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
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

    it("should do no operation if the table entry doesn't exist", async () => {
      const messageVersion = 1;

      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const purposeId = purpose.id;
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);
      const purposeVersions: PurposeVersion[] = [
        getMockPurposeVersion(purposeVersionState.active),
      ];

      // platform-states
      const purposeEntryPrimaryKey = makePlatformStatesPurposePK(purposeId);
      const previousRetrievedPlatformPurposeEntry =
        await readPlatformPurposeEntry(dynamoDBClient, purposeEntryPrimaryKey);
      expect(previousRetrievedPlatformPurposeEntry).toBeUndefined();

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
        async () =>
          await handleMessageV1(message, dynamoDBClient, genericLogger)
      ).not.toThrowError();

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      expect(retrievedPlatformPurposeEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient1,
          tokenGenStatesConsumerClient2,
        ])
      );
    });
  });

  describe("PurposeVersionArchived", () => {
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

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      expect(retrievedPlatformPurposeEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          consumerId: purpose.consumerId,
          purposeState: itemState.inactive,
          purposeVersionId: purposeVersions[0].id,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          consumerId: purpose.consumerId,
          purposeState: itemState.inactive,
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
  });
});
