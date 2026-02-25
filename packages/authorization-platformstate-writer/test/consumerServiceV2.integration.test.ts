/* eslint-disable @typescript-eslint/no-non-null-assertion */
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
  getMockClient,
  getMockTokenGenStatesApiClient,
  getMockTokenGenStatesConsumerClient,
  readAllPlatformStatesItems,
  readAllTokenGenStatesItems,
  getMockPurpose,
  getMockPurposeVersion,
  writePlatformPurposeEntry,
  getMockAgreement,
  writePlatformAgreementEntry,
  getMockDescriptor,
  writePlatformCatalogEntry,
  getMockKey,
  writeTokenGenStatesConsumerClient,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AuthorizationEventEnvelope,
  Client,
  ClientDeletedV2,
  ClientId,
  ClientKeyAddedV2,
  ClientKeyDeletedV2,
  clientKindTokenGenStates,
  ClientPurposeAddedV2,
  ClientPurposeRemovedV2,
  Descriptor,
  generateId,
  itemState,
  makeGSIPKClientIdPurposeId,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makeGSIPKClientIdKid,
  makePlatformStatesAgreementPK,
  makePlatformStatesClientPK,
  makePlatformStatesEServiceDescriptorPK,
  makePlatformStatesPurposePK,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  PlatformStatesAgreementEntry,
  PlatformStatesCatalogEntry,
  PlatformStatesClientEntry,
  PlatformStatesPurposeEntry,
  Purpose,
  PurposeId,
  purposeVersionState,
  TenantId,
  toClientV2,
  TokenGenerationStatesApiClient,
  TokenGenerationStatesConsumerClient,
  clientKind,
  UserId,
  ClientAdminSetV2,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { handleMessageV2 } from "../src/consumerServiceV2.js";
import {
  clientKindToTokenGenerationStatesClientKind,
  readPlatformClientEntry,
  writePlatformClientEntry,
  writeTokenGenStatesApiClient,
} from "../src/utils.js";
import { dynamoDBClient } from "./utils.js";

describe("integration tests V2 events", async () => {
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
    it("should do no operation if the existing table entry is more recent", async () => {
      const previousPlatformEntryVersion = 2;
      const messageVersion = 1;

      const key = getMockKey();
      const client: Client = {
        ...getMockClient(),
        keys: [key],
        purposes: [generateId<PurposeId>()],
      };

      const payload: ClientKeyAddedV2 = {
        client: toClientV2(client),
        kid: key.kid,
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientKeyAdded",
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
        clientPurposesIds: client.purposes,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: key.kid,
      });
      const tokenClientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK),
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: key.kid,
        }),
      };
      await writeTokenGenStatesApiClient(
        tokenClientEntry,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toEqual(previousPlatformClientEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toEqual([tokenClientEntry]);
    });

    it("ConsumerClient - should insert platform-states entry and insert token-generation-states client-kid-purpose entries if the client contains at least one purpose", async () => {
      const messageVersion = 2;

      const consumerId = generateId<TenantId>();
      const purpose1: Purpose = {
        ...getMockPurpose(),
        consumerId,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const purpose2: Purpose = {
        ...getMockPurpose(),
        consumerId,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const oldKey = getMockKey();
      const addedKey = getMockKey();
      const client: Client = {
        ...getMockClient(),
        keys: [oldKey, addedKey],
        purposes: [purpose1.id, purpose2.id],
      };

      const payload: ClientKeyAddedV2 = {
        client: toClientV2(client),
        kid: addedKey.kid,
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientKeyAdded",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformPurposeEntry1: PlatformStatesPurposeEntry = {
        PK: makePlatformStatesPurposePK(purpose1.id),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        purposeVersionId: purpose1.versions[0].id,
        purposeEserviceId: purpose1.eserviceId,
        purposeConsumerId: purpose1.consumerId,
      };
      await writePlatformPurposeEntry(platformPurposeEntry1, dynamoDBClient);

      const platformPurposeEntry2: PlatformStatesPurposeEntry = {
        PK: makePlatformStatesPurposePK(purpose2.id),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        purposeVersionId: purpose2.versions[0].id,
        purposeEserviceId: purpose2.eserviceId,
        purposeConsumerId: purpose2.consumerId,
      };
      await writePlatformPurposeEntry(platformPurposeEntry2, dynamoDBClient);

      const agreement1: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId: purpose1.eserviceId,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const platformAgreementEntry1: PlatformStatesAgreementEntry = {
        PK: makePlatformStatesAgreementPK({
          consumerId,
          eserviceId: agreement1.eserviceId,
        }),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        agreementId: agreement1.id,
        agreementTimestamp: agreement1.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement1.descriptorId,
        producerId: agreement1.producerId,
      };
      await writePlatformAgreementEntry(
        platformAgreementEntry1,
        dynamoDBClient
      );

      const agreement2: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId: purpose2.eserviceId,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const platformAgreementEntry2: PlatformStatesAgreementEntry = {
        PK: makePlatformStatesAgreementPK({
          consumerId,
          eserviceId: agreement2.eserviceId,
        }),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        agreementId: agreement2.id,
        agreementTimestamp: agreement2.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement2.descriptorId,
        producerId: agreement2.producerId,
      };
      await writePlatformAgreementEntry(
        platformAgreementEntry2,
        dynamoDBClient
      );

      const descriptor1: Descriptor = {
        ...getMockDescriptor(),
        id: agreement1.descriptorId,
      };
      const previousDescriptorEntry1: PlatformStatesCatalogEntry = {
        PK: makePlatformStatesEServiceDescriptorPK({
          eserviceId: agreement1.eserviceId,
          descriptorId: descriptor1.id,
        }),
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: descriptor1.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousDescriptorEntry1, dynamoDBClient);

      const descriptor2: Descriptor = {
        ...getMockDescriptor(),
        id: agreement2.descriptorId,
      };
      const previousDescriptorEntry2: PlatformStatesCatalogEntry = {
        PK: makePlatformStatesEServiceDescriptorPK({
          eserviceId: agreement2.eserviceId,
          descriptorId: descriptor2.id,
        }),
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: descriptor2.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousDescriptorEntry2, dynamoDBClient);

      const platformClientPK = makePlatformStatesClientPK(client.id);
      expect(
        await readPlatformClientEntry(platformClientPK, dynamoDBClient)
      ).toBeUndefined();

      // token-generation-states
      const tokenClientKidPurposePK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: oldKey.kid,
          purposeId: purpose1.id,
        });
      const tokenClientKidPurposePK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: oldKey.kid,
          purposeId: purpose2.id,
        });
      const gsiPKClientIdPurposeId1 = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: purpose1.id,
      });
      const gsiPKClientIdPurposeId2 = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: purpose2.id,
      });
      const tokenConsumerClient1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK1),
        consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: oldKey.kid,
        }),
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId1,
        GSIPK_purposeId: purpose1.id,
      };
      const tokenConsumerClient2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK2),
        consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: oldKey.kid,
        }),
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId2,
        GSIPK_purposeId: purpose2.id,
      };
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient1,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        clientPurposesIds: [],
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformClientEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenConsumerClient1,
          PK: makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            kid: addedKey.kid,
            purposeId: purpose1.id,
          }),
          GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
            consumerId,
            eserviceId: agreement1.eserviceId,
          }),
          agreementId: agreement1.id,
          agreementState: platformAgreementEntry1.state,
          producerId: agreement1.producerId,
          GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
            eserviceId: agreement1.eserviceId,
            descriptorId: descriptor1.id,
          }),
          descriptorState: previousDescriptorEntry1.state,
          descriptorAudience: previousDescriptorEntry1.descriptorAudience,
          descriptorVoucherLifespan:
            previousDescriptorEntry1.descriptorVoucherLifespan,
          GSIPK_purposeId: purpose1.id,
          purposeState: platformPurposeEntry1.state,
          purposeVersionId: platformPurposeEntry1.purposeVersionId,
          publicKey: addedKey.encodedPem,
          GSIPK_clientId_kid: makeGSIPKClientIdKid({
            clientId: client.id,
            kid: addedKey.kid,
          }),
          GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
            clientId: client.id,
            purposeId: purpose1.id,
          }),
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenConsumerClient2,
          PK: makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            kid: addedKey.kid,
            purposeId: purpose2.id,
          }),
          GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
            consumerId,
            eserviceId: agreement2.eserviceId,
          }),
          agreementId: agreement2.id,
          agreementState: platformAgreementEntry2.state,
          producerId: agreement2.producerId,
          GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
            eserviceId: agreement2.eserviceId,
            descriptorId: descriptor2.id,
          }),
          descriptorState: previousDescriptorEntry2.state,
          descriptorAudience: previousDescriptorEntry2.descriptorAudience,
          descriptorVoucherLifespan:
            previousDescriptorEntry2.descriptorVoucherLifespan,
          GSIPK_purposeId: purpose2.id,
          purposeState: platformPurposeEntry2.state,
          purposeVersionId: platformPurposeEntry2.purposeVersionId,
          publicKey: addedKey.encodedPem,
          GSIPK_clientId_kid: makeGSIPKClientIdKid({
            clientId: client.id,
            kid: addedKey.kid,
          }),
          GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
            clientId: client.id,
            purposeId: purpose2.id,
          }),
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(4);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenConsumerClient1,
          tokenConsumerClient2,
          expectedTokenConsumerClient1,
          expectedTokenConsumerClient2,
        ])
      );
    });

    it("ConsumerClient - should update platform-states entry and insert token-generation-states client-kid-purpose entries", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const consumerId = generateId<TenantId>();
      const purpose1: Purpose = {
        ...getMockPurpose(),
        consumerId,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const purpose2: Purpose = {
        ...getMockPurpose(),
        consumerId,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const oldKey = getMockKey();
      const addedKey = getMockKey();
      const client: Client = {
        ...getMockClient(),
        keys: [oldKey, addedKey],
        purposes: [purpose1.id, purpose2.id],
      };

      const payload: ClientKeyAddedV2 = {
        client: toClientV2(client),
        kid: addedKey.kid,
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientKeyAdded",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformPurposeEntry1: PlatformStatesPurposeEntry = {
        PK: makePlatformStatesPurposePK(purpose1.id),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        purposeVersionId: purpose1.versions[0].id,
        purposeEserviceId: purpose1.eserviceId,
        purposeConsumerId: purpose1.consumerId,
      };
      await writePlatformPurposeEntry(platformPurposeEntry1, dynamoDBClient);

      const platformPurposeEntry2: PlatformStatesPurposeEntry = {
        PK: makePlatformStatesPurposePK(purpose2.id),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        purposeVersionId: purpose2.versions[0].id,
        purposeEserviceId: purpose2.eserviceId,
        purposeConsumerId: purpose2.consumerId,
      };
      await writePlatformPurposeEntry(platformPurposeEntry2, dynamoDBClient);

      const agreement1: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId: purpose1.eserviceId,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const platformAgreementEntry1: PlatformStatesAgreementEntry = {
        PK: makePlatformStatesAgreementPK({
          consumerId,
          eserviceId: agreement1.eserviceId,
        }),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        agreementId: agreement1.id,
        agreementTimestamp: agreement1.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement1.descriptorId,
        producerId: agreement1.producerId,
      };
      await writePlatformAgreementEntry(
        platformAgreementEntry1,
        dynamoDBClient
      );

      const agreement2: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId: purpose2.eserviceId,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const platformAgreementEntry2: PlatformStatesAgreementEntry = {
        PK: makePlatformStatesAgreementPK({
          consumerId,
          eserviceId: agreement2.eserviceId,
        }),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        agreementId: agreement2.id,
        agreementTimestamp: agreement2.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement2.descriptorId,
        producerId: agreement2.producerId,
      };
      await writePlatformAgreementEntry(
        platformAgreementEntry2,
        dynamoDBClient
      );

      const descriptor1: Descriptor = {
        ...getMockDescriptor(),
        id: agreement1.descriptorId,
      };
      const previousDescriptorEntry1: PlatformStatesCatalogEntry = {
        PK: makePlatformStatesEServiceDescriptorPK({
          eserviceId: purpose1.eserviceId,
          descriptorId: descriptor1.id,
        }),
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: descriptor1.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousDescriptorEntry1, dynamoDBClient);

      const descriptor2: Descriptor = {
        ...getMockDescriptor(),
        id: agreement2.descriptorId,
      };
      const previousDescriptorEntry2: PlatformStatesCatalogEntry = {
        PK: makePlatformStatesEServiceDescriptorPK({
          eserviceId: purpose2.eserviceId,
          descriptorId: descriptor2.id,
        }),
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: descriptor2.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousDescriptorEntry2, dynamoDBClient);

      const platformClientPK = makePlatformStatesClientPK(client.id);
      const previousPlatformClientEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        version: previousPlatformEntryVersion,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [purpose1.id, purpose2.id],
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenClientKidPurposePK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: oldKey.kid,
          purposeId: purpose1.id,
        });
      const tokenClientKidPurposePK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: oldKey.kid,
          purposeId: purpose2.id,
        });
      const gsiPKClientIdPurposeId1 = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: purpose1.id,
      });
      const gsiPKClientIdPurposeId2 = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: purpose2.id,
      });
      const tokenConsumerClient1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK1),
        consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: oldKey.kid,
        }),
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId1,
        GSIPK_purposeId: purpose1.id,
      };
      const tokenConsumerClient2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK2),
        consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: oldKey.kid,
        }),
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId2,
        GSIPK_purposeId: purpose2.id,
      };
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient1,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        ...previousPlatformClientEntry,
        clientPurposesIds: [],
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformClientEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenConsumerClient1,
          PK: makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            kid: addedKey.kid,
            purposeId: purpose1.id,
          }),
          GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
            consumerId,
            eserviceId: agreement1.eserviceId,
          }),
          agreementId: agreement1.id,
          agreementState: platformAgreementEntry1.state,
          producerId: agreement1.producerId,
          GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
            eserviceId: agreement1.eserviceId,
            descriptorId: descriptor1.id,
          }),
          descriptorState: previousDescriptorEntry1.state,
          descriptorAudience: previousDescriptorEntry1.descriptorAudience,
          descriptorVoucherLifespan:
            previousDescriptorEntry1.descriptorVoucherLifespan,
          GSIPK_purposeId: purpose1.id,
          purposeState: platformPurposeEntry1.state,
          purposeVersionId: platformPurposeEntry1.purposeVersionId,
          publicKey: addedKey.encodedPem,
          GSIPK_clientId_kid: makeGSIPKClientIdKid({
            clientId: client.id,
            kid: addedKey.kid,
          }),
          GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
            clientId: client.id,
            purposeId: purpose1.id,
          }),
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenConsumerClient2,
          PK: makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            kid: addedKey.kid,
            purposeId: purpose2.id,
          }),
          GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
            consumerId,
            eserviceId: agreement2.eserviceId,
          }),
          agreementId: agreement2.id,
          agreementState: platformAgreementEntry2.state,
          producerId: agreement2.producerId,
          GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
            eserviceId: agreement2.eserviceId,
            descriptorId: descriptor2.id,
          }),
          descriptorState: previousDescriptorEntry2.state,
          descriptorAudience: previousDescriptorEntry2.descriptorAudience,
          descriptorVoucherLifespan:
            previousDescriptorEntry2.descriptorVoucherLifespan,
          GSIPK_purposeId: purpose2.id,
          purposeState: platformPurposeEntry2.state,
          purposeVersionId: platformPurposeEntry2.purposeVersionId,
          publicKey: addedKey.encodedPem,
          GSIPK_clientId_kid: makeGSIPKClientIdKid({
            clientId: client.id,
            kid: addedKey.kid,
          }),
          GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
            clientId: client.id,
            purposeId: purpose2.id,
          }),
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(4);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenConsumerClient1,
          tokenConsumerClient2,
          expectedTokenConsumerClient1,
          expectedTokenConsumerClient2,
        ])
      );
    });

    it("ConsumerClient - should update platform-states entry and update token-generation-states client-kid-purpose entries", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const consumerId = generateId<TenantId>();
      const purpose1: Purpose = {
        ...getMockPurpose(),
        consumerId,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const purpose2: Purpose = {
        ...getMockPurpose(),
        consumerId,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const oldKey = getMockKey();
      const addedKey = getMockKey();
      const client: Client = {
        ...getMockClient(),
        keys: [oldKey, addedKey],
        purposes: [purpose1.id, purpose2.id],
      };

      const payload: ClientKeyAddedV2 = {
        client: toClientV2(client),
        kid: addedKey.kid,
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientKeyAdded",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformPurposeEntry1: PlatformStatesPurposeEntry = {
        PK: makePlatformStatesPurposePK(purpose1.id),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        purposeVersionId: purpose1.versions[0].id,
        purposeEserviceId: purpose1.eserviceId,
        purposeConsumerId: purpose1.consumerId,
      };
      await writePlatformPurposeEntry(platformPurposeEntry1, dynamoDBClient);

      const platformPurposeEntry2: PlatformStatesPurposeEntry = {
        PK: makePlatformStatesPurposePK(purpose2.id),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        purposeVersionId: purpose2.versions[0].id,
        purposeEserviceId: purpose2.eserviceId,
        purposeConsumerId: purpose2.consumerId,
      };
      await writePlatformPurposeEntry(platformPurposeEntry2, dynamoDBClient);

      const agreement1: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId: purpose1.eserviceId,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const platformAgreementEntry1: PlatformStatesAgreementEntry = {
        PK: makePlatformStatesAgreementPK({
          consumerId,
          eserviceId: agreement1.eserviceId,
        }),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        agreementId: agreement1.id,
        agreementTimestamp: agreement1.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement1.descriptorId,
        producerId: agreement1.producerId,
      };
      await writePlatformAgreementEntry(
        platformAgreementEntry1,
        dynamoDBClient
      );

      const agreement2: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId: purpose2.eserviceId,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const platformAgreementEntry2: PlatformStatesAgreementEntry = {
        PK: makePlatformStatesAgreementPK({
          consumerId,
          eserviceId: agreement2.eserviceId,
        }),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        agreementId: agreement2.id,
        agreementTimestamp: agreement2.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement2.descriptorId,
        producerId: agreement2.producerId,
      };
      await writePlatformAgreementEntry(
        platformAgreementEntry2,
        dynamoDBClient
      );

      const descriptor1: Descriptor = {
        ...getMockDescriptor(),
        id: agreement1.descriptorId,
      };
      const previousDescriptorEntry1: PlatformStatesCatalogEntry = {
        PK: makePlatformStatesEServiceDescriptorPK({
          eserviceId: purpose1.eserviceId,
          descriptorId: descriptor1.id,
        }),
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: descriptor1.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousDescriptorEntry1, dynamoDBClient);

      const descriptor2: Descriptor = {
        ...getMockDescriptor(),
        id: agreement2.descriptorId,
      };
      const previousDescriptorEntry2: PlatformStatesCatalogEntry = {
        PK: makePlatformStatesEServiceDescriptorPK({
          eserviceId: purpose2.eserviceId,
          descriptorId: descriptor2.id,
        }),
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: descriptor2.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousDescriptorEntry2, dynamoDBClient);

      const platformClientPK = makePlatformStatesClientPK(client.id);
      const previousPlatformClientEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        version: previousPlatformEntryVersion,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [purpose1.id, purpose2.id],
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenClientKidPurposePK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: oldKey.kid,
          purposeId: purpose1.id,
        });
      const tokenClientKidPurposePK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: oldKey.kid,
          purposeId: purpose2.id,
        });
      const tokenClientKidPurposePK3 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: addedKey.kid,
          purposeId: purpose1.id,
        });
      const tokenClientKidPurposePK4 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: addedKey.kid,
          purposeId: purpose2.id,
        });

      const gsiPKClientIdPurposeId1 = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: purpose1.id,
      });
      const gsiPKClientIdPurposeId2 = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: purpose2.id,
      });
      const gsiPKClientIdPurposeId3 = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: purpose1.id,
      });
      const gsiPKClientIdPurposeId4 = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: purpose2.id,
      });

      const tokenConsumerClient1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK1),
        consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: oldKey.kid,
        }),
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId1,
        GSIPK_purposeId: purpose1.id,
      };
      const tokenConsumerClient2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK2),
        consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: oldKey.kid,
        }),
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId2,
        GSIPK_purposeId: purpose2.id,
      };
      const tokenConsumerClient3: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK3),
        consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: addedKey.kid,
        }),
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId3,
        GSIPK_purposeId: purpose1.id,
      };
      const tokenConsumerClient4: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK4),
        consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: addedKey.kid,
        }),
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId4,
        GSIPK_purposeId: purpose2.id,
      };
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient1,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient2,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient3,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient4,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        ...previousPlatformClientEntry,
        clientPurposesIds: [],
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformClientEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenConsumerClient1,
          PK: makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            kid: addedKey.kid,
            purposeId: purpose1.id,
          }),
          GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
            consumerId,
            eserviceId: agreement1.eserviceId,
          }),
          agreementId: agreement1.id,
          agreementState: platformAgreementEntry1.state,
          producerId: agreement1.producerId,
          GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
            eserviceId: agreement1.eserviceId,
            descriptorId: descriptor1.id,
          }),
          descriptorState: previousDescriptorEntry1.state,
          descriptorAudience: previousDescriptorEntry1.descriptorAudience,
          descriptorVoucherLifespan:
            previousDescriptorEntry1.descriptorVoucherLifespan,
          GSIPK_purposeId: purpose1.id,
          purposeState: platformPurposeEntry1.state,
          purposeVersionId: platformPurposeEntry1.purposeVersionId,
          publicKey: addedKey.encodedPem,
          GSIPK_clientId_kid: makeGSIPKClientIdKid({
            clientId: client.id,
            kid: addedKey.kid,
          }),
          GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
            clientId: client.id,
            purposeId: purpose1.id,
          }),
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenConsumerClient2,
          PK: makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            kid: addedKey.kid,
            purposeId: purpose2.id,
          }),
          GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
            consumerId,
            eserviceId: agreement2.eserviceId,
          }),
          agreementId: agreement2.id,
          agreementState: platformAgreementEntry2.state,
          producerId: agreement2.producerId,
          GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
            eserviceId: agreement2.eserviceId,
            descriptorId: descriptor2.id,
          }),
          descriptorState: previousDescriptorEntry2.state,
          descriptorAudience: previousDescriptorEntry2.descriptorAudience,
          descriptorVoucherLifespan:
            previousDescriptorEntry2.descriptorVoucherLifespan,
          GSIPK_purposeId: purpose2.id,
          purposeState: platformPurposeEntry2.state,
          purposeVersionId: platformPurposeEntry2.purposeVersionId,
          publicKey: addedKey.encodedPem,
          GSIPK_clientId_kid: makeGSIPKClientIdKid({
            clientId: client.id,
            kid: addedKey.kid,
          }),
          GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
            clientId: client.id,
            purposeId: purpose2.id,
          }),
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(4);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenConsumerClient1,
          tokenConsumerClient2,
          expectedTokenConsumerClient1,
          expectedTokenConsumerClient2,
        ])
      );
    });

    it("ConsumerClient - should insert platform-states entry and add no entries in token-generation-states if the client does not contain purposes", async () => {
      const messageVersion = 1;

      const oldKey = getMockKey();
      const addedKey = getMockKey();
      const client: Client = {
        ...getMockClient(),
        keys: [oldKey, addedKey],
      };

      const payload: ClientKeyAddedV2 = {
        client: toClientV2(client),
        kid: addedKey.kid,
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientKeyAdded",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformClientPK = makePlatformStatesClientPK(client.id);
      expect(
        await readPlatformClientEntry(platformClientPK, dynamoDBClient)
      ).toBeUndefined();

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        version: messageVersion,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [],
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
      };
      expect(retrievedPlatformClientEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);

      expect(retrievedTokenGenStatesEntries).toHaveLength(0);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([])
      );
    });

    it("ApiClient - should update platform-states entry and insert token-generation-states client-kid entry", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const oldKey = getMockKey();
      const addedKey = getMockKey();
      const client: Client = {
        ...getMockClient(),
        kind: clientKind.api,
        keys: [oldKey, addedKey],
      };

      const payload: ClientKeyAddedV2 = {
        client: toClientV2(client),
        kid: addedKey.kid,
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientKeyAdded",
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
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: oldKey.kid,
      });
      const tokenClientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK),
        consumerId: client.consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: oldKey.kid,
        }),
      };
      await writeTokenGenStatesApiClient(
        tokenClientEntry,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        ...previousPlatformClientEntry,
        clientPurposesIds: [],
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformClientEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenClientEntry: TokenGenerationStatesApiClient = {
        PK: makeTokenGenerationStatesClientKidPK({
          clientId: client.id,
          kid: addedKey.kid,
        }),
        consumerId: client.consumerId,
        clientKind: clientKindTokenGenStates.api,
        publicKey: addedKey.encodedPem,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: addedKey.kid,
        }),
        updatedAt: new Date().toISOString(),
      };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([tokenClientEntry, expectedTokenClientEntry])
      );
    });

    it("ApiClient - should update platform-states entry and update token-generation-states client-kid entry", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const oldKey = getMockKey();
      const addedKey = getMockKey();
      const client: Client = {
        ...getMockClient(),
        kind: clientKind.api,
        keys: [oldKey, addedKey],
      };

      const payload: ClientKeyAddedV2 = {
        client: toClientV2(client),
        kid: addedKey.kid,
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientKeyAdded",
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
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenClientKidPK1 = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: oldKey.kid,
      });
      const tokenClientKidPK2 = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: addedKey.kid,
      });
      const tokenClientEntry1: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK1),
        consumerId: client.consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: oldKey.kid,
        }),
      };
      const tokenClientEntry2: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK2),
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: addedKey.kid,
        }),
      };
      await writeTokenGenStatesApiClient(
        tokenClientEntry1,
        dynamoDBClient,
        genericLogger
      );
      await writeTokenGenStatesApiClient(
        tokenClientEntry2,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        ...previousPlatformClientEntry,
        clientPurposesIds: [],
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformClientEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenClientEntry: TokenGenerationStatesApiClient = {
        PK: makeTokenGenerationStatesClientKidPK({
          clientId: client.id,
          kid: addedKey.kid,
        }),
        consumerId: client.consumerId,
        clientKind: clientKindTokenGenStates.api,
        publicKey: addedKey.encodedPem,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: addedKey.kid,
        }),
        updatedAt: new Date().toISOString(),
      };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([tokenClientEntry1, expectedTokenClientEntry])
      );
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
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [],
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: kidToRemove,
      });
      const tokenClientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK),
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: kidToRemove,
        }),
      };
      await writeTokenGenStatesApiClient(
        tokenClientEntry,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toEqual(previousPlatformClientEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toEqual([tokenClientEntry]);
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
      const tokenClientKidPurposePK =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: kidToRemove,
          purposeId,
        });

      const tokenConsumerClientWithKid: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK),
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: kidToRemove,
        }),
        GSIPK_clientId: client.id,
      };
      const tokenConsumerClientWithOtherKid: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_clientId: client.id,
        };

      await writeTokenGenStatesConsumerClient(
        tokenConsumerClientWithKid,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClientWithOtherKid,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const platformClientPK = makePlatformStatesClientPK(client.id);
      const retrievedPlatformStatesEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        clientPurposesIds: [],
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformStatesEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toEqual([
        tokenConsumerClientWithOtherKid,
      ]);
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
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [purposeId],
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
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

      const tokenConsumerClientWithKid: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK),
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: kidToRemove,
        }),
        GSIPK_clientId: client.id,
      };

      const tokenClientEntryWithOtherKid: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK),
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: otherKid,
        }),
      };

      await writeTokenGenStatesConsumerClient(
        tokenConsumerClientWithKid,
        dynamoDBClient
      );
      await writeTokenGenStatesApiClient(
        tokenClientEntryWithOtherKid,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformStatesEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        ...previousPlatformClientEntry,
        clientPurposesIds: [],
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformStatesEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toEqual([
        tokenClientEntryWithOtherKid,
      ]);
    });
  });

  describe("ClientPurposeAdded", () => {
    it("should do no operation if the existing table entry is more recent", async () => {
      const previousPlatformEntryVersion = 2;
      const messageVersion = 1;

      const purposeId = generateId<PurposeId>();
      const client: Client = {
        ...getMockClient(),
        purposes: [purposeId],
      };

      const payload: ClientPurposeAddedV2 = {
        purposeId,
        client: toClientV2(client),
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientPurposeAdded",
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
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [],
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );
      // token-generation-states
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: "KID",
      });
      const tokenClientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK),
        GSIPK_clientId: client.id,
      };
      await writeTokenGenStatesApiClient(
        tokenClientEntry,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toEqual(previousPlatformClientEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toEqual([tokenClientEntry]);
    });

    it("should update only platform-states entry if there are no keys in the client", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const purposeId = generateId<PurposeId>();
      const client: Client = {
        ...getMockClient(),
        purposes: [purposeId],
      };

      const payload: ClientPurposeAddedV2 = {
        purposeId,
        client: toClientV2(client),
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientPurposeAdded",
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
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,

        updatedAt: new Date().toISOString(),
        clientPurposesIds: [purposeId],
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenConsumerClient = getMockTokenGenStatesConsumerClient();
      const tokenClientEntry = getMockTokenGenStatesApiClient();
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient,
        dynamoDBClient
      );
      await writeTokenGenStatesApiClient(
        tokenClientEntry,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformStatesEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        ...previousPlatformClientEntry,
        version: messageVersion,
        clientPurposesIds: [],
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformStatesEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([tokenConsumerClient, tokenClientEntry])
      );
    });

    it("should update platform-states entry and insert client-kid-purpose entries to token-generation-states table", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const consumerId = generateId<TenantId>();
      const purpose1: Purpose = {
        ...getMockPurpose(),
        consumerId,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const purpose2: Purpose = {
        ...getMockPurpose(),
        consumerId,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };

      const key1 = getMockKey();
      const key2 = getMockKey();
      const client: Client = {
        ...getMockClient(),
        purposes: [purpose1.id, purpose2.id],
        keys: [key1, key2],
      };

      const payload: ClientPurposeAddedV2 = {
        purposeId: purpose2.id,
        client: toClientV2(client),
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientPurposeAdded",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformPurposeEntry1: PlatformStatesPurposeEntry = {
        PK: makePlatformStatesPurposePK(purpose1.id),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        purposeVersionId: purpose1.versions[0].id,
        purposeEserviceId: purpose1.eserviceId,
        purposeConsumerId: purpose1.consumerId,
      };
      await writePlatformPurposeEntry(platformPurposeEntry1, dynamoDBClient);

      const platformPurposeEntry2: PlatformStatesPurposeEntry = {
        PK: makePlatformStatesPurposePK(purpose2.id),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        purposeVersionId: purpose2.versions[0].id,
        purposeEserviceId: purpose2.eserviceId,
        purposeConsumerId: purpose2.consumerId,
      };
      await writePlatformPurposeEntry(platformPurposeEntry2, dynamoDBClient);

      const agreement1: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId: purpose1.eserviceId,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const platformAgreementEntry1: PlatformStatesAgreementEntry = {
        PK: makePlatformStatesAgreementPK({
          consumerId,
          eserviceId: agreement1.eserviceId,
        }),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        agreementId: agreement1.id,
        agreementTimestamp: agreement1.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement1.descriptorId,
        producerId: agreement1.producerId,
      };
      await writePlatformAgreementEntry(
        platformAgreementEntry1,
        dynamoDBClient
      );

      const agreement2: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId: purpose2.eserviceId,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const platformAgreementEntry2: PlatformStatesAgreementEntry = {
        PK: makePlatformStatesAgreementPK({
          consumerId,
          eserviceId: agreement2.eserviceId,
        }),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        agreementId: agreement2.id,
        agreementTimestamp: agreement2.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement2.descriptorId,
        producerId: agreement2.producerId,
      };
      await writePlatformAgreementEntry(
        platformAgreementEntry2,
        dynamoDBClient
      );

      const descriptor1: Descriptor = {
        ...getMockDescriptor(),
        id: agreement1.descriptorId,
      };
      const previousDescriptorEntry1: PlatformStatesCatalogEntry = {
        PK: makePlatformStatesEServiceDescriptorPK({
          eserviceId: purpose1.eserviceId,
          descriptorId: descriptor1.id,
        }),
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: descriptor1.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousDescriptorEntry1, dynamoDBClient);

      const descriptor2: Descriptor = {
        ...getMockDescriptor(),
        id: agreement2.descriptorId,
      };
      const previousDescriptorEntry2: PlatformStatesCatalogEntry = {
        PK: makePlatformStatesEServiceDescriptorPK({
          eserviceId: purpose2.eserviceId,
          descriptorId: descriptor2.id,
        }),
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: descriptor2.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousDescriptorEntry2, dynamoDBClient);

      const platformClientPK = makePlatformStatesClientPK(client.id);
      const previousPlatformClientEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        version: previousPlatformEntryVersion,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [purpose1.id],
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenClientKidPurposePK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: key1.kid,
          purposeId: purpose1.id,
        });
      const tokenClientKidPurposePK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: key2.kid,
          purposeId: purpose1.id,
        });

      const gsiPKClientIdPurposeId1 = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: purpose1.id,
      });
      const tokenConsumerClient1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK1),
        consumerId,
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId1,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: key1.kid,
        }),
        GSIPK_purposeId: purpose1.id,
        publicKey: key1.encodedPem,
      };
      const tokenConsumerClient2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK2),
        consumerId,
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId1,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: key2.kid,
        }),
        GSIPK_purposeId: purpose1.id,
        publicKey: key2.encodedPem,
      };
      const tokenClientEntryWithOtherClient = getMockTokenGenStatesApiClient();

      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient1,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient2,
        dynamoDBClient
      );
      await writeTokenGenStatesApiClient(
        tokenClientEntryWithOtherClient,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformStatesEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        ...previousPlatformClientEntry,
        version: messageVersion,
        clientPurposesIds: [],
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformStatesEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const newTokenConsumerClientData: Partial<TokenGenerationStatesConsumerClient> =
        {
          GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
            clientId: client.id,
            purposeId: purpose2.id,
          }),
          GSIPK_purposeId: purpose2.id,
          purposeState: platformPurposeEntry2.state,
          purposeVersionId: platformPurposeEntry2.purposeVersionId,
          GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
            consumerId,
            eserviceId: agreement2.eserviceId,
          }),
          agreementId: agreement2.id,
          agreementState: platformAgreementEntry2.state,
          producerId: agreement2.producerId,
          GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
            eserviceId: agreement2.eserviceId,
            descriptorId: descriptor2.id,
          }),
          descriptorState: previousDescriptorEntry2.state,
          descriptorAudience: previousDescriptorEntry2.descriptorAudience,
          descriptorVoucherLifespan:
            previousDescriptorEntry2.descriptorVoucherLifespan,
          updatedAt: new Date().toISOString(),
        };

      const expectedTokenConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenConsumerClient1,
          ...newTokenConsumerClientData,
          PK: makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            purposeId: purpose2.id,
            kid: key1.kid,
          }),
        };

      const expectedTokenConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenConsumerClient2,
          ...newTokenConsumerClientData,
          PK: makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            purposeId: purpose2.id,
            kid: key2.kid,
          }),
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(5);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenClientEntryWithOtherClient,
          tokenConsumerClient1,
          tokenConsumerClient2,
          expectedTokenConsumerClient1,
          expectedTokenConsumerClient2,
        ])
      );
    });

    it("should update platform-states entry and update client-kid-purpose entries in token-generation-states table", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const consumerId = generateId<TenantId>();
      const purpose1: Purpose = {
        ...getMockPurpose(),
        consumerId,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const purpose2: Purpose = {
        ...getMockPurpose(),
        consumerId,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };

      const key1 = getMockKey();
      const key2 = getMockKey();
      const client: Client = {
        ...getMockClient(),
        purposes: [purpose1.id, purpose2.id],
        keys: [key1, key2],
      };

      const payload: ClientPurposeAddedV2 = {
        purposeId: purpose2.id,
        client: toClientV2(client),
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientPurposeAdded",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformPurposeEntry1: PlatformStatesPurposeEntry = {
        PK: makePlatformStatesPurposePK(purpose1.id),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        purposeVersionId: purpose1.versions[0].id,
        purposeEserviceId: purpose1.eserviceId,
        purposeConsumerId: purpose1.consumerId,
      };
      await writePlatformPurposeEntry(platformPurposeEntry1, dynamoDBClient);

      const platformPurposeEntry2: PlatformStatesPurposeEntry = {
        PK: makePlatformStatesPurposePK(purpose2.id),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        purposeVersionId: purpose2.versions[0].id,
        purposeEserviceId: purpose2.eserviceId,
        purposeConsumerId: purpose2.consumerId,
      };
      await writePlatformPurposeEntry(platformPurposeEntry2, dynamoDBClient);

      const agreement1: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId: purpose1.eserviceId,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const platformAgreementEntry1: PlatformStatesAgreementEntry = {
        PK: makePlatformStatesAgreementPK({
          consumerId,
          eserviceId: agreement1.eserviceId,
        }),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        agreementId: agreement1.id,
        agreementTimestamp: agreement1.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement1.descriptorId,
        producerId: agreement1.producerId,
      };
      await writePlatformAgreementEntry(
        platformAgreementEntry1,
        dynamoDBClient
      );

      const agreement2: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId: purpose2.eserviceId,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const platformAgreementEntry2: PlatformStatesAgreementEntry = {
        PK: makePlatformStatesAgreementPK({
          consumerId,
          eserviceId: agreement2.eserviceId,
        }),
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        agreementId: agreement2.id,
        agreementTimestamp: agreement2.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement2.descriptorId,
        producerId: agreement2.producerId,
      };
      await writePlatformAgreementEntry(
        platformAgreementEntry2,
        dynamoDBClient
      );

      const descriptor1: Descriptor = {
        ...getMockDescriptor(),
        id: agreement1.descriptorId,
      };
      const previousDescriptorEntry1: PlatformStatesCatalogEntry = {
        PK: makePlatformStatesEServiceDescriptorPK({
          eserviceId: purpose1.eserviceId,
          descriptorId: descriptor1.id,
        }),
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: descriptor1.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousDescriptorEntry1, dynamoDBClient);

      const descriptor2: Descriptor = {
        ...getMockDescriptor(),
        id: agreement2.descriptorId,
      };
      const previousDescriptorEntry2: PlatformStatesCatalogEntry = {
        PK: makePlatformStatesEServiceDescriptorPK({
          eserviceId: purpose2.eserviceId,
          descriptorId: descriptor2.id,
        }),
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: descriptor2.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousDescriptorEntry2, dynamoDBClient);

      const platformClientPK = makePlatformStatesClientPK(client.id);
      const previousPlatformClientEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        version: previousPlatformEntryVersion,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [purpose1.id],
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenClientKidPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: client.id,
        kid: key1.kid,
        purposeId: purpose1.id,
      });
      const tokenClientKidPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: client.id,
        kid: key2.kid,
        purposeId: purpose1.id,
      });
      const tokenClientKidPK3 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: client.id,
        kid: key1.kid,
        purposeId: purpose2.id,
      });
      const tokenClientKidPK4 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: client.id,
        kid: key2.kid,
        purposeId: purpose2.id,
      });

      const gsiPKClientIdPurposeId1 = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: purpose1.id,
      });
      const gsiPKClientIdPurposeId2 = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: purpose2.id,
      });
      const tokenConsumerClient1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPK1),
        consumerId,
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId1,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: key1.kid,
        }),
        GSIPK_purposeId: purpose1.id,
        publicKey: key1.encodedPem,
      };
      const tokenConsumerClient2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPK2),
        consumerId,
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId1,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: key2.kid,
        }),
        GSIPK_purposeId: purpose1.id,
        publicKey: key2.encodedPem,
      };
      const tokenConsumerClient3: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPK3),
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId2,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: key1.kid,
        }),
        GSIPK_purposeId: purpose2.id,
        publicKey: key1.encodedPem,
      };
      const tokenConsumerClient4: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPK4),
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId2,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: key2.kid,
        }),
        GSIPK_purposeId: purpose2.id,
        publicKey: key2.encodedPem,
      };
      const tokenClientEntryWithOtherClient = getMockTokenGenStatesApiClient();

      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient1,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient2,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient3,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient4,
        dynamoDBClient
      );
      await writeTokenGenStatesApiClient(
        tokenClientEntryWithOtherClient,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformStatesEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        ...previousPlatformClientEntry,
        version: messageVersion,
        clientPurposesIds: [],
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformStatesEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const newTokenConsumerClientData: Partial<TokenGenerationStatesConsumerClient> =
        {
          consumerId,
          GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
            clientId: client.id,
            purposeId: purpose2.id,
          }),
          GSIPK_purposeId: purpose2.id,
          purposeState: platformPurposeEntry2.state,
          purposeVersionId: platformPurposeEntry2.purposeVersionId,
          GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
            consumerId,
            eserviceId: agreement2.eserviceId,
          }),
          agreementId: agreement2.id,
          agreementState: platformAgreementEntry2.state,
          producerId: agreement2.producerId,
          GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
            eserviceId: agreement2.eserviceId,
            descriptorId: descriptor2.id,
          }),
          descriptorState: previousDescriptorEntry2.state,
          descriptorAudience: previousDescriptorEntry2.descriptorAudience,
          descriptorVoucherLifespan:
            previousDescriptorEntry2.descriptorVoucherLifespan,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenConsumerClient3: TokenGenerationStatesConsumerClient =
        {
          ...tokenConsumerClient3,
          ...newTokenConsumerClientData,
        };
      const expectedTokenConsumerClient4: TokenGenerationStatesConsumerClient =
        {
          ...tokenConsumerClient4,
          ...newTokenConsumerClientData,
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(5);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenClientEntryWithOtherClient,
          tokenConsumerClient1,
          tokenConsumerClient2,
          expectedTokenConsumerClient3,
          expectedTokenConsumerClient4,
        ])
      );
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
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [],
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: "KID",
      });
      const tokenClientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK),
        GSIPK_clientId: client.id,
      };
      await writeTokenGenStatesApiClient(
        tokenClientEntry,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toEqual(previousPlatformClientEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toEqual([tokenClientEntry]);
    });

    it("should do no operation if the purpose platform-states entry doesn't exist and the token-generation-states entries aren't associated to the purpose id in the message", async () => {
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
        await readPlatformClientEntry(platformClientPK, dynamoDBClient)
      ).toBeUndefined();

      // token-generation-states
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: "KID",
      });

      const tokenClientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK),
        GSIPK_clientId: client.id,
      };
      await writeTokenGenStatesApiClient(
        tokenClientEntry,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toEqual([tokenClientEntry]);
    });

    it("should update platform-states entry and delete token-generation-states entries for that purpose (the removed purposeId wasn't the only one left)", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const key1 = getMockKey();
      const key2 = getMockKey();
      const purposeId1 = generateId<PurposeId>();
      const removedPurposeId = generateId<PurposeId>();
      const client: Client = {
        ...getMockClient(),
        keys: [key1, key2],
        purposes: [purposeId1],
      };

      const payload: ClientPurposeRemovedV2 = {
        purposeId: removedPurposeId,
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
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [purposeId1, removedPurposeId],
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenClientKidPurposePK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: key1.kid,
          purposeId: purposeId1,
        });
      const tokenClientKidPurposePK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: key1.kid,
          purposeId: removedPurposeId,
        });

      const tokenClientKidPurposePK3 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: key2.kid,
          purposeId: purposeId1,
        });
      const tokenClientKidPurposePK4 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: key2.kid,
          purposeId: removedPurposeId,
        });

      const gsiPKClientIdPurposeId1 = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: purposeId1,
      });
      const gsiPKClientIdPurposeId2 = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: removedPurposeId,
      });

      const tokenClientEntry = getMockTokenGenStatesApiClient();

      const tokenConsumerClient1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK1),
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId1,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: key1.kid,
        }),
        GSIPK_purposeId: purposeId1,
      };

      const tokenConsumerClient2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK2),
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId2,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: key1.kid,
        }),
        GSIPK_purposeId: removedPurposeId,
      };

      const tokenConsumerClient3: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK3),
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId1,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: key2.kid,
        }),
        GSIPK_purposeId: purposeId1,
      };

      const tokenConsumerClient4: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK4),
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId2,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: key2.kid,
        }),
        GSIPK_purposeId: removedPurposeId,
      };

      await writeTokenGenStatesApiClient(
        tokenClientEntry,
        dynamoDBClient,
        genericLogger
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient1,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient2,
        dynamoDBClient
      );

      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient3,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient4,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformStatesEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        ...previousPlatformClientEntry,
        clientPurposesIds: [],
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformStatesEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toHaveLength(3);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenClientEntry,
          tokenConsumerClient1,
          tokenConsumerClient3,
        ])
      );
    });

    it("should update platform-states entry and delete token-generation-states entries for that purpose (the removed purposeId was the only one left)", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const key1 = getMockKey();
      const key2 = getMockKey();
      const removedPurposeId = generateId<PurposeId>();
      const client: Client = {
        ...getMockClient(),
        keys: [key1, key2],
        purposes: [],
      };

      const payload: ClientPurposeRemovedV2 = {
        purposeId: removedPurposeId,
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
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [removedPurposeId],
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenClientKidPurposePK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: key1.kid,
          purposeId: removedPurposeId,
        });
      const tokenClientKidPurposePK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: key2.kid,
          purposeId: removedPurposeId,
        });

      const gsiPKClientIdPurposeId = makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: removedPurposeId,
      });

      const tokenClientEntry = getMockTokenGenStatesApiClient();

      const tokenConsumerClient1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK1),
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: key1.kid,
        }),
        GSIPK_purposeId: removedPurposeId,
      };

      const tokenConsumerClient2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK2),
        GSIPK_clientId_purposeId: gsiPKClientIdPurposeId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: key2.kid,
        }),
        GSIPK_purposeId: removedPurposeId,
      };

      await writeTokenGenStatesApiClient(
        tokenClientEntry,
        dynamoDBClient,
        genericLogger
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient1,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformStatesEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        ...previousPlatformClientEntry,
        clientPurposesIds: [],
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformStatesEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toHaveLength(1);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([tokenClientEntry])
      );
    });
  });

  describe("ClientAdminRoleRevoked", () => {
    it("should do no operation if the existing table entry is more recent", async () => {
      const previousPlatformEntryVersion = 2;
      const messageVersion = 1;

      const adminId = generateId<UserId>();

      const client: Client = {
        ...getMockClient(),
        adminId: undefined,
      };

      const payload = {
        adminId,
        client: toClientV2(client),
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientAdminRoleRevoked",
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
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [],
        clientAdminId: adminId,
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const key = getMockKey();
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: key.kid,
      });
      const tokenClientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK),
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: key.kid,
        }),
        adminId,
      };
      await writeTokenGenStatesApiClient(
        tokenClientEntry,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toEqual(previousPlatformClientEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toEqual([tokenClientEntry]);
    });

    it("should update platform-states entry and remove adminId from token-generation-states entries", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const adminId = generateId<UserId>();

      const key1 = getMockKey();
      const key2 = getMockKey();
      const client: Client = {
        ...getMockClient(),
        keys: [key1, key2],
        adminId,
      };

      const payload = {
        adminId,
        client: toClientV2(client),
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientAdminRoleRevoked",
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
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [],
        clientAdminId: adminId,
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenClientKidPK1 = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: key1.kid,
      });
      const tokenClientKidPK2 = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: key2.kid,
      });
      const tokenClientEntry1: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK1),
        consumerId: client.consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: key1.kid,
        }),
        adminId,
      };
      const tokenClientEntry2: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK2),
        consumerId: client.consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: key2.kid,
        }),
        adminId,
      };
      await writeTokenGenStatesApiClient(
        tokenClientEntry1,
        dynamoDBClient,
        genericLogger
      );
      await writeTokenGenStatesApiClient(
        tokenClientEntry2,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        ...previousPlatformClientEntry,
        clientAdminId: undefined,
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformClientEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenClientEntry1 = {
        ...tokenClientEntry1,
        adminId: undefined,
      };
      const expectedTokenClientEntry2 = {
        ...tokenClientEntry2,
        adminId: undefined,
      };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenClientEntry1,
          expectedTokenClientEntry2,
        ])
      );
    });

    it("should do nothing if client entry doesn't exist in platform-states", async () => {
      const messageVersion = 1;
      const adminId = generateId<UserId>();

      const client: Client = getMockClient();

      const payload = {
        adminId,
        client: toClientV2(client),
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientAdminRoleRevoked",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };

      // token-generation-states
      const key = getMockKey();
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: key.kid,
      });
      const tokenClientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK),
        GSIPK_clientId: client.id,
        adminId,
      };
      await writeTokenGenStatesApiClient(
        tokenClientEntry,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const platformClientPK = makePlatformStatesClientPK(client.id);
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toEqual([tokenClientEntry]);
    });
  });

  describe("ClientAdminRemoved", () => {
    it("should do no operation if the existing table entry is more recent", async () => {
      const previousPlatformEntryVersion = 2;
      const messageVersion = 1;

      const adminId = generateId<UserId>();

      const client: Client = {
        ...getMockClient(),
        adminId: undefined,
      };

      const payload = {
        adminId,
        client: toClientV2(client),
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientAdminRemoved",
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
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [],
        clientAdminId: adminId,
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const key = getMockKey();
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: key.kid,
      });
      const tokenClientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK),
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: key.kid,
        }),
        adminId,
      };
      await writeTokenGenStatesApiClient(
        tokenClientEntry,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toEqual(previousPlatformClientEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toEqual([tokenClientEntry]);
    });

    it("should update platform-states entry and remove adminId from token-generation-states entries", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;

      const adminId = generateId<UserId>();

      const key1 = getMockKey();
      const key2 = getMockKey();
      const client: Client = {
        ...getMockClient(),
        keys: [key1, key2],
        adminId,
      };

      const payload = {
        adminId,
        client: toClientV2(client),
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientAdminRemoved",
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
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [],
        clientAdminId: adminId,
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenClientKidPK1 = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: key1.kid,
      });
      const tokenClientKidPK2 = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: key2.kid,
      });
      const tokenClientEntry1: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK1),
        consumerId: client.consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: key1.kid,
        }),
        adminId,
      };
      const tokenClientEntry2: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK2),
        consumerId: client.consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: key2.kid,
        }),
        adminId,
      };
      await writeTokenGenStatesApiClient(
        tokenClientEntry1,
        dynamoDBClient,
        genericLogger
      );
      await writeTokenGenStatesApiClient(
        tokenClientEntry2,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesClientEntry = {
        ...previousPlatformClientEntry,
        clientAdminId: undefined,
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformClientEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenClientEntry1 = {
        ...tokenClientEntry1,
        adminId: undefined,
      };
      const expectedTokenClientEntry2 = {
        ...tokenClientEntry2,
        adminId: undefined,
      };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenClientEntry1,
          expectedTokenClientEntry2,
        ])
      );
    });

    it("should do nothing if client entry doesn't exist in platform-states", async () => {
      const messageVersion = 1;
      const adminId = generateId<UserId>();

      const client: Client = getMockClient();

      const payload = {
        adminId,
        client: toClientV2(client),
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientAdminRemoved",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };

      // token-generation-states
      const key = getMockKey();
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: key.kid,
      });
      const tokenClientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK),
        GSIPK_clientId: client.id,
        adminId,
      };
      await writeTokenGenStatesApiClient(
        tokenClientEntry,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const platformClientPK = makePlatformStatesClientPK(client.id);
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toEqual([tokenClientEntry]);
    });
  });

  describe("ClientDeleted", () => {
    it("should delete platform-states entry and token-generation-states entries", async () => {
      const messageVersion = 2;
      const key1 = getMockKey();
      const key2 = getMockKey();

      const purposeId = generateId<PurposeId>();
      const client: Client = {
        ...getMockClient(),
        keys: [key1, key2],
        purposes: [purposeId],
      };

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
      await writePlatformClientEntry(
        clientPlatformStateEntry1,
        dynamoDBClient,
        genericLogger
      );
      await writePlatformClientEntry(
        clientPlatformStateEntry2,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const pkTokenGenStates1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: client.id,
        kid: key1.kid,
        purposeId,
      });

      const pkTokenGenStates2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: client.id,
        kid: key2.kid,
        purposeId,
      });

      const clientPurposeTokenGenStatesEntry1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(pkTokenGenStates1),
          GSIPK_clientId: client.id,
        };
      const clientPurposeTokenGenStatesEntry2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(pkTokenGenStates2),
          GSIPK_clientId: client.id,
        };

      const otherClientPurposeTokenGenStatesEntry: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          GSIPK_clientId: otherClientId,
        };

      await writeTokenGenStatesConsumerClient(
        clientPurposeTokenGenStatesEntry1,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        clientPurposeTokenGenStatesEntry2,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        otherClientPurposeTokenGenStatesEntry,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformStatesEntries =
        await readAllPlatformStatesItems(dynamoDBClient);
      expect(retrievedPlatformStatesEntries).toEqual([
        clientPlatformStateEntry2,
      ]);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toEqual([
        otherClientPurposeTokenGenStatesEntry,
      ]);
    });
  });

  describe("ClientAdminSet", () => {
    it("should do no operation if the existing table entry is more recent", async () => {
      const previousPlatformEntryVersion = 2;
      const messageVersion = 1;

      const key = getMockKey();
      const client: Client = {
        ...getMockClient(),
        keys: [key],
        purposes: [generateId<PurposeId>()],
        kind: "Api",
      };

      const payload: ClientAdminSetV2 = {
        client: toClientV2(client),
        adminId: generateId<UserId>(),
      };
      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientAdminSet",
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
        clientPurposesIds: client.purposes,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: key.kid,
      });
      const tokenClientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK),
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: key.kid,
        }),
      };
      await writeTokenGenStatesApiClient(
        tokenClientEntry,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toEqual(previousPlatformClientEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toEqual([tokenClientEntry]);
    });

    it("ApiClient - should update platform-states and token-generation-states entries", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;
      const newAdminId = generateId<UserId>();

      const client: Client = {
        ...getMockClient(),
        kind: clientKind.api,
        keys: [getMockKey(), getMockKey()],
      };

      const updatedClient: Client = {
        ...client,
        adminId: newAdminId,
      };

      const payload: ClientAdminSetV2 = {
        client: toClientV2(updatedClient),
        adminId: newAdminId,
      };

      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientAdminSet",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };

      const platformClientPK = makePlatformStatesClientPK(client.id);
      const previousPlatformClientEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        version: previousPlatformEntryVersion,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [],
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenClientKidPK1 = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: client.keys[0].kid,
      });
      const tokenClientKidPK2 = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: client.keys[1].kid,
      });
      const tokenClientEntry1: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK1),
        consumerId: client.consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: client.keys[0].kid,
        }),
      };
      const tokenClientEntry2: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK2),
        consumerId: client.consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: client.keys[1].kid,
        }),
      };

      await writeTokenGenStatesApiClient(
        tokenClientEntry1,
        dynamoDBClient,
        genericLogger
      );

      await writeTokenGenStatesApiClient(
        tokenClientEntry2,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // update platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toMatchObject({
        PK: platformClientPK,
        version: messageVersion,
        clientAdminId: newAdminId,
        clientConsumerId: client.consumerId,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
      });

      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            PK: tokenClientKidPK1,
            adminId: newAdminId,
          }),
          expect.objectContaining({
            PK: tokenClientKidPK2,
            adminId: newAdminId,
          }),
          expect.objectContaining({
            PK: makeTokenGenerationStatesClientKidPK({
              clientId: client.id,
              kid: client.keys[0].kid,
            }),
            adminId: newAdminId,
            publicKey: client.keys[0].encodedPem,
          }),
          expect.objectContaining({
            PK: makeTokenGenerationStatesClientKidPK({
              clientId: client.id,
              kid: client.keys[1].kid,
            }),
            adminId: newAdminId,
            publicKey: client.keys[1].encodedPem,
          }),
        ])
      );
    });

    it("ApiClient - should update platform-states and token-generation-states entries for a client that already had an adminId", async () => {
      const previousPlatformEntryVersion = 1;
      const messageVersion = 2;
      const oldAdminId = generateId<UserId>();
      const newAdminId = generateId<UserId>();

      const client: Client = {
        ...getMockClient(),
        kind: clientKind.api,
        keys: [getMockKey(), getMockKey()],
        adminId: oldAdminId,
      };

      const updatedClient: Client = {
        ...client,
        adminId: newAdminId,
      };

      const payload: ClientAdminSetV2 = {
        client: toClientV2(updatedClient),
        oldAdminId: client.adminId,
        adminId: newAdminId,
      };

      const message: AuthorizationEventEnvelope = {
        sequence_num: 1,
        stream_id: client.id,
        version: messageVersion,
        type: "ClientAdminSet",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };

      const platformClientPK = makePlatformStatesClientPK(client.id);
      const previousPlatformClientEntry: PlatformStatesClientEntry = {
        PK: platformClientPK,
        version: previousPlatformEntryVersion,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        clientPurposesIds: [],
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        clientAdminId: oldAdminId,
      };
      await writePlatformClientEntry(
        previousPlatformClientEntry,
        dynamoDBClient,
        genericLogger
      );

      const tokenClientKidPK1 = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: client.keys[0].kid,
      });

      const tokenClientKidPK2 = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: client.keys[1].kid,
      });

      const tokenClientEntry1: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK1),
        consumerId: client.consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: client.keys[0].kid,
        }),
        adminId: oldAdminId,
      };

      const tokenClientEntry2: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(tokenClientKidPK2),
        consumerId: client.consumerId,
        GSIPK_clientId: client.id,
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: client.keys[1].kid,
        }),
        adminId: oldAdminId,
      };

      await writeTokenGenStatesApiClient(
        tokenClientEntry1,
        dynamoDBClient,
        genericLogger
      );

      await writeTokenGenStatesApiClient(
        tokenClientEntry2,
        dynamoDBClient,
        genericLogger
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // update platform-states
      const retrievedPlatformClientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );
      expect(retrievedPlatformClientEntry).toMatchObject({
        PK: platformClientPK,
        version: messageVersion,
        clientAdminId: newAdminId,
        clientConsumerId: client.consumerId,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
      });

      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            PK: tokenClientKidPK1,
            adminId: newAdminId,
          }),
          expect.objectContaining({
            PK: tokenClientKidPK2,
            adminId: newAdminId,
          }),
          expect.objectContaining({
            PK: makeTokenGenerationStatesClientKidPK({
              clientId: client.id,
              kid: client.keys[0].kid,
            }),
            adminId: newAdminId,
            publicKey: client.keys[0].encodedPem,
          }),
          expect.objectContaining({
            PK: makeTokenGenerationStatesClientKidPK({
              clientId: client.id,
              kid: client.keys[1].kid,
            }),
            adminId: newAdminId,
            publicKey: client.keys[1].encodedPem,
          }),
        ])
      );
    });
  });
});
