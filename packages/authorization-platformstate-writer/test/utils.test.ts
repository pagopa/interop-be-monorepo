/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockPlatformStatesAgreementEntry,
  getMockKey,
  getMockPlatformStatesClientEntry,
  getMockPurposeVersion,
  getMockTokenStatesClientEntry,
  getMockTokenStatesConsumerClient,
  getMockPurpose,
  getMockClient,
  readAllPlatformStatesItems,
  readAllTokenStatesItems,
  writePlatformCatalogEntry,
  writePlatformAgreementEntry,
  writePlatformPurposeEntry,
  writeTokenStatesConsumerClient,
  getMockAgreement,
  getMockDescriptor,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementId,
  Client,
  ClientId,
  clientKindTokenStates,
  DescriptorId,
  EService,
  EServiceId,
  generateId,
  GSIPKKid,
  itemState,
  makeGSIPKClientIdPurposeId,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makeGSIPKKid,
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
  TokenGenerationStatesApiClient,
  TokenGenerationStatesConsumerClient,
  TokenGenerationStatesGenericClient,
  unsafeBrandId,
} from "pagopa-interop-models";
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
import { z } from "zod";
import {
  setClientPurposeIdsInPlatformStatesEntry,
  convertEntriesToClientKidInTokenGenerationStates,
  deleteClientEntryFromPlatformStates,
  readConsumerClientEntriesInTokenGenerationStates,
  readPlatformAgreementEntryByGSIPKConsumerIdEServiceId,
  retrievePlatformStatesByPurpose,
  updateTokenDataForSecondRetrieval,
  upsertPlatformClientEntry,
  writeTokenStatesApiClient,
  deleteEntriesFromTokenStatesByKid,
  writePlatformClientEntry,
  deleteEntriesFromTokenStatesByClientId,
  deleteClientEntryFromTokenGenerationStates,
  readPlatformClientEntry,
  deleteEntriesFromTokenStatesByGSIPKClientIdPurposeId,
  upsertTokenStatesConsumerClient,
  upsertTokenApiClient,
} from "../src/utils.js";
import { config } from "./utils.js";

describe("utils", () => {
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

  it("deleteEntriesFromTokenStatesByKid", async () => {
    const kid = unsafeBrandId<GSIPKKid>("mock kid");
    const clientEntry: TokenGenerationStatesApiClient = {
      ...getMockTokenStatesClientEntry(),
      GSIPK_kid: kid,
    };

    const clientPurposeEntry: TokenGenerationStatesConsumerClient = {
      ...getMockTokenStatesConsumerClient(),
      GSIPK_kid: kid,
    };

    const otherClientPurposeEntry: TokenGenerationStatesConsumerClient = {
      ...getMockTokenStatesConsumerClient(),
    };

    await writeTokenStatesApiClient(clientEntry, dynamoDBClient);
    await writeTokenStatesConsumerClient(clientPurposeEntry, dynamoDBClient);
    await writeTokenStatesConsumerClient(
      otherClientPurposeEntry,
      dynamoDBClient
    );

    await deleteEntriesFromTokenStatesByKid(kid, dynamoDBClient);

    const result = await readAllTokenStatesItems(dynamoDBClient);
    expect(result).toEqual([otherClientPurposeEntry]);
  });

  it("deleteClientEntryFromPlatformStates", async () => {
    const pk1 = makePlatformStatesClientPK(generateId<ClientId>());
    const pk2 = makePlatformStatesClientPK(generateId<ClientId>());

    const clientEntry1: PlatformStatesClientEntry = {
      ...getMockPlatformStatesClientEntry(pk1),
    };
    const clientEntry2: PlatformStatesClientEntry = {
      ...getMockPlatformStatesClientEntry(pk2),
    };

    await writePlatformClientEntry(clientEntry1, dynamoDBClient);
    await writePlatformClientEntry(clientEntry2, dynamoDBClient);

    await deleteClientEntryFromPlatformStates(pk1, dynamoDBClient);

    const res = await readAllPlatformStatesItems(dynamoDBClient);

    expect(res).toEqual([clientEntry2]);
  });

  it("deleteEntriesFromTokenStatesByClientId", async () => {
    const GSIPK_clientId = generateId<ClientId>();

    const clientEntry: TokenGenerationStatesApiClient = {
      ...getMockTokenStatesClientEntry(),
      GSIPK_clientId,
    };

    const clientPurposeEntry: TokenGenerationStatesConsumerClient = {
      ...getMockTokenStatesConsumerClient(),
      GSIPK_clientId,
    };

    const otherClientPurposeEntry: TokenGenerationStatesConsumerClient = {
      ...getMockTokenStatesConsumerClient(),
    };
    await writeTokenStatesApiClient(clientEntry, dynamoDBClient);
    await writeTokenStatesConsumerClient(clientPurposeEntry, dynamoDBClient);
    await writeTokenStatesConsumerClient(
      otherClientPurposeEntry,
      dynamoDBClient
    );

    await deleteEntriesFromTokenStatesByClientId(
      GSIPK_clientId,
      dynamoDBClient
    );

    const result = await readAllTokenStatesItems(dynamoDBClient);
    expect(result).toEqual([otherClientPurposeEntry]);
  });

  describe("deleteClientEntryFromTokenGenerationStates", () => {
    it("clientKid entry", async () => {
      const clientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenStatesClientEntry(),
      };

      const clientPurposeEntry: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(),
      };

      await writeTokenStatesApiClient(clientEntry, dynamoDBClient);
      await writeTokenStatesConsumerClient(clientPurposeEntry, dynamoDBClient);

      await deleteClientEntryFromTokenGenerationStates(
        clientEntry,
        dynamoDBClient
      );

      const result = await readAllTokenStatesItems(dynamoDBClient);
      expect(result).toEqual([clientPurposeEntry]);
    });
    it("clientKidPurpose entry", async () => {
      const clientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenStatesClientEntry(),
      };

      const clientPurposeEntry: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(),
      };

      await writeTokenStatesApiClient(clientEntry, dynamoDBClient);
      await writeTokenStatesConsumerClient(clientPurposeEntry, dynamoDBClient);

      await deleteClientEntryFromTokenGenerationStates(
        clientPurposeEntry,
        dynamoDBClient
      );

      const result = await readAllTokenStatesItems(dynamoDBClient);
      expect(result).toEqual([clientEntry]);
    });
  });

  it("readPlatformClientEntry", async () => {
    const clientEntry1 = getMockPlatformStatesClientEntry();

    const clientEntry2 = getMockPlatformStatesClientEntry();

    await writePlatformClientEntry(clientEntry1, dynamoDBClient);
    await writePlatformClientEntry(clientEntry2, dynamoDBClient);

    const res = await readPlatformClientEntry(clientEntry1.PK, dynamoDBClient);

    expect(res).toEqual(clientEntry1);
  });

  it("deleteEntriesFromTokenStatesByGSIPKClientIdPurposeId", async () => {
    const GSIPK_clientId_purposeId = makeGSIPKClientIdPurposeId({
      clientId: generateId(),
      purposeId: generateId(),
    });
    const clientPurposeEntry1: TokenGenerationStatesConsumerClient = {
      ...getMockTokenStatesConsumerClient(),
      GSIPK_clientId_purposeId,
    };

    const clientPurposeEntry2: TokenGenerationStatesConsumerClient = {
      ...getMockTokenStatesConsumerClient(),
      GSIPK_clientId_purposeId,
    };

    const clientPurposeEntry3 = getMockTokenStatesConsumerClient();

    await writeTokenStatesConsumerClient(clientPurposeEntry1, dynamoDBClient);
    await writeTokenStatesConsumerClient(clientPurposeEntry2, dynamoDBClient);
    await writeTokenStatesConsumerClient(clientPurposeEntry3, dynamoDBClient);

    await deleteEntriesFromTokenStatesByGSIPKClientIdPurposeId(
      GSIPK_clientId_purposeId,
      dynamoDBClient
    );

    const result = await readAllTokenStatesItems(dynamoDBClient);
    expect(result).toEqual([clientPurposeEntry3]);
  });

  it("convertEntriesToClientKidInTokenGenerationStates", async () => {
    const clientId = generateId<ClientId>();
    const kid1 = "kid1";
    const kid2 = "kid2";

    const purposeId = generateId<PurposeId>();
    const GSIPK_clientId_purposeId = makeGSIPKClientIdPurposeId({
      clientId,
      purposeId,
    });

    const pk1 = makeTokenGenerationStatesClientKidPurposePK({
      clientId,
      kid: kid1,
      purposeId,
    });
    const clientKidPurposeEntry1: TokenGenerationStatesConsumerClient = {
      ...getMockTokenStatesConsumerClient(pk1),
      GSIPK_clientId_purposeId,
      GSIPK_clientId: clientId,
      GSIPK_kid: unsafeBrandId<GSIPKKid>(kid1),
    };

    const pk2 = makeTokenGenerationStatesClientKidPurposePK({
      clientId,
      kid: kid2,
      purposeId,
    });
    const clientKidPurposeEntry2: TokenGenerationStatesConsumerClient = {
      ...getMockTokenStatesConsumerClient(pk2),
      GSIPK_clientId_purposeId,
      GSIPK_clientId: clientId,
      GSIPK_kid: unsafeBrandId<GSIPKKid>(kid2),
    };

    const clientKidPurposeEntry3 = getMockTokenStatesConsumerClient();

    await writeTokenStatesConsumerClient(
      clientKidPurposeEntry1,
      dynamoDBClient
    );
    await writeTokenStatesConsumerClient(
      clientKidPurposeEntry2,
      dynamoDBClient
    );
    await writeTokenStatesConsumerClient(
      clientKidPurposeEntry3,
      dynamoDBClient
    );

    await convertEntriesToClientKidInTokenGenerationStates(
      GSIPK_clientId_purposeId,
      dynamoDBClient
    );

    const expectedEntry1: TokenGenerationStatesConsumerClient = {
      consumerId: clientKidPurposeEntry1.consumerId,
      updatedAt: new Date().toISOString(),
      PK: makeTokenGenerationStatesClientKidPK({ clientId, kid: kid1 }),
      clientKind: clientKindTokenStates.consumer,
      publicKey: clientKidPurposeEntry1.publicKey,
      GSIPK_clientId: clientId,
      GSIPK_kid: unsafeBrandId<GSIPKKid>(kid1),
    };

    const expectedEntry2: TokenGenerationStatesConsumerClient = {
      consumerId: clientKidPurposeEntry2.consumerId,
      updatedAt: new Date().toISOString(),
      PK: makeTokenGenerationStatesClientKidPK({ clientId, kid: kid2 }),
      clientKind: "CONSUMER",
      publicKey: clientKidPurposeEntry1.publicKey,
      GSIPK_clientId: clientId,
      GSIPK_kid: unsafeBrandId<GSIPKKid>(kid2),
    };

    const result = await readAllTokenStatesItems(dynamoDBClient);
    expect(result).toEqual(
      expect.arrayContaining([
        expectedEntry2,
        expectedEntry1,
        clientKidPurposeEntry3,
      ])
    );
  });

  describe("writeTokenStatesApiClient", () => {
    it("should succeed if the entry doesn't exist", async () => {
      const clientEntry = getMockTokenStatesClientEntry();
      await writeTokenStatesApiClient(clientEntry, dynamoDBClient);

      const result = await readAllTokenStatesItems(dynamoDBClient);
      expect(result).toEqual([clientEntry]);
    });

    it("should throw error if the entry already exists", async () => {
      const clientEntry = getMockTokenStatesClientEntry();
      await writeTokenStatesApiClient(clientEntry, dynamoDBClient);

      expect(
        writeTokenStatesApiClient(clientEntry, dynamoDBClient)
      ).rejects.toThrowError();
    });
  });

  it("readPlatformAgreementEntryByGSIPKConsumerIdEServiceId", async () => {
    const pk1 = makePlatformStatesAgreementPK(generateId<AgreementId>());
    const pk2 = makePlatformStatesAgreementPK(generateId<AgreementId>());
    const pk3 = makePlatformStatesAgreementPK(generateId<AgreementId>());

    const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
      consumerId: generateId(),
      eserviceId: generateId(),
    });

    const threeHoursAgo = new Date();
    threeHoursAgo.setHours(threeHoursAgo.getHours() - 3);

    const agreementEntry1: PlatformStatesAgreementEntry = {
      ...getMockPlatformStatesAgreementEntry(pk1, GSIPK_consumerId_eserviceId),
      GSISK_agreementTimestamp: threeHoursAgo.toISOString(),
    };

    const agreementEntry2: PlatformStatesAgreementEntry = {
      ...getMockPlatformStatesAgreementEntry(pk2, GSIPK_consumerId_eserviceId),
      GSISK_agreementTimestamp: new Date().toISOString(),
    };

    const agreementEntry3 = getMockPlatformStatesAgreementEntry(pk3);

    await writePlatformAgreementEntry(agreementEntry1, dynamoDBClient);
    await writePlatformAgreementEntry(agreementEntry2, dynamoDBClient);
    await writePlatformAgreementEntry(agreementEntry3, dynamoDBClient);

    const res = await readPlatformAgreementEntryByGSIPKConsumerIdEServiceId(
      GSIPK_consumerId_eserviceId,
      dynamoDBClient
    );

    expect(res).toEqual(agreementEntry2);
  });

  describe("upsertTokenStatesConsumerClient", () => {
    it("write", async () => {
      const clientKidPurposeEntry = getMockTokenStatesConsumerClient();

      const resultBefore = await readAllTokenStatesItems(dynamoDBClient);
      expect(resultBefore).toEqual([]);

      await upsertTokenStatesConsumerClient(
        clientKidPurposeEntry,
        dynamoDBClient
      );

      const resultAfter = await readAllTokenStatesItems(dynamoDBClient);
      expect(resultAfter).toEqual([clientKidPurposeEntry]);
    });
    it("update", async () => {
      const clientKidPurposeEntry: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(),
        descriptorState: itemState.active,
      };
      await writeTokenStatesConsumerClient(
        clientKidPurposeEntry,
        dynamoDBClient
      );

      const updatedEntry: TokenGenerationStatesConsumerClient = {
        ...clientKidPurposeEntry,
        descriptorState: itemState.inactive,
      };
      await upsertTokenStatesConsumerClient(updatedEntry, dynamoDBClient);

      const resultAfter = await readAllTokenStatesItems(dynamoDBClient);
      expect(resultAfter).toEqual([updatedEntry]);
    });
  });

  it("readConsumerClientEntriesInTokenGenerationStates", async () => {
    const clientId = generateId<ClientId>();
    const pk1 = makeTokenGenerationStatesClientKidPK({ clientId, kid: "" });
    const pk2 = makeTokenGenerationStatesClientKidPurposePK({
      clientId,
      kid: "",
      purposeId: generateId<PurposeId>(),
    });

    const GSIPK_clientId = clientId;

    const clientKidEntry: TokenGenerationStatesApiClient = {
      ...getMockTokenStatesClientEntry(pk1),
      GSIPK_clientId,
    };

    const clientKidPurposeEntry: TokenGenerationStatesConsumerClient = {
      ...getMockTokenStatesConsumerClient(pk2),
      GSIPK_clientId,
    };

    await writeTokenStatesApiClient(clientKidEntry, dynamoDBClient);
    await writeTokenStatesConsumerClient(clientKidPurposeEntry, dynamoDBClient);

    const res = await readConsumerClientEntriesInTokenGenerationStates(
      GSIPK_clientId,
      dynamoDBClient
    );

    expect(res).toEqual(
      expect.arrayContaining([clientKidEntry, clientKidPurposeEntry])
    );
  });

  it("setClientPurposeIdsInPlatformStatesEntry", async () => {
    const clientEntry1: PlatformStatesClientEntry = {
      ...getMockPlatformStatesClientEntry(),
      clientPurposesIds: [generateId(), generateId()],
    };
    const clientEntry2: PlatformStatesClientEntry = {
      ...getMockPlatformStatesClientEntry(),
      clientPurposesIds: [generateId(), generateId()],
    };

    await writePlatformClientEntry(clientEntry1, dynamoDBClient);
    await writePlatformClientEntry(clientEntry2, dynamoDBClient);

    await setClientPurposeIdsInPlatformStatesEntry(
      {
        primaryKey: clientEntry1.PK,
        version: clientEntry1.version + 1,
        clientPurposeIds: [],
      },
      dynamoDBClient
    );

    const res = await readAllPlatformStatesItems(dynamoDBClient);
    expect(res).toEqual(
      expect.arrayContaining([
        {
          ...clientEntry1,
          clientPurposesIds: [],
          version: clientEntry1.version + 1,
        },
        clientEntry2,
      ])
    );
  });

  it("retrievePlatformStatesByPurpose", async () => {
    const purposeId = generateId<PurposeId>();
    const purposePK = makePlatformStatesPurposePK(purposeId);
    const agreementId = generateId<AgreementId>();
    const eserviceId = generateId<EServiceId>();
    const descriptorId = generateId<DescriptorId>();
    const consumerId = generateId<TenantId>();

    const purposeEntry: PlatformStatesPurposeEntry = {
      PK: purposePK,
      state: itemState.inactive,
      purposeVersionId: generateId(),
      purposeEserviceId: eserviceId,
      purposeConsumerId: consumerId,
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    await writePlatformPurposeEntry(purposeEntry, dynamoDBClient);

    const agreementPK = makePlatformStatesAgreementPK(agreementId);
    const agreementEntry: PlatformStatesAgreementEntry = {
      ...getMockPlatformStatesAgreementEntry(agreementPK),
      agreementDescriptorId: descriptorId,
      GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      }),
    };

    await writePlatformAgreementEntry(agreementEntry, dynamoDBClient);

    const catalogPK = makePlatformStatesEServiceDescriptorPK({
      eserviceId,
      descriptorId,
    });
    const catalogEntry: PlatformStatesCatalogEntry = {
      PK: catalogPK,
      state: itemState.active,
      descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
      descriptorVoucherLifespan: 60,
      version: 3,
      updatedAt: new Date().toISOString(),
    };

    await writePlatformCatalogEntry(catalogEntry, dynamoDBClient);

    const res = await retrievePlatformStatesByPurpose(
      purposeId,
      dynamoDBClient
    );

    expect(res).toEqual({
      purposeEntry,
      agreementEntry,
      catalogEntry,
    });
  });

  describe("upsertPlatformClientEntry", () => {
    it("write", async () => {
      const clientEntry: PlatformStatesClientEntry = {
        ...getMockPlatformStatesClientEntry(),
        clientKind: clientKindTokenStates.consumer,
      };

      const resultBefore = await readAllPlatformStatesItems(dynamoDBClient);
      expect(resultBefore).toEqual([]);

      await upsertPlatformClientEntry(clientEntry, dynamoDBClient);

      const resultAfter = await readAllPlatformStatesItems(dynamoDBClient);
      expect(resultAfter).toEqual([clientEntry]);
    });
    it("update", async () => {
      const clientEntry: PlatformStatesClientEntry = {
        ...getMockPlatformStatesClientEntry(),
        clientKind: clientKindTokenStates.consumer,
      };

      await writePlatformClientEntry(clientEntry, dynamoDBClient);

      const updatedEntry: PlatformStatesClientEntry = {
        ...clientEntry,
        clientKind: clientKindTokenStates.api,
      };
      await upsertPlatformClientEntry(updatedEntry, dynamoDBClient);

      const resultAfter = await readAllPlatformStatesItems(dynamoDBClient);
      expect(resultAfter).toEqual([updatedEntry]);
    });
  });

  describe("upsertTokenApiClient", () => {
    it("write", async () => {
      const clientKidEntry = getMockTokenStatesClientEntry();

      const resultBefore = await readAllTokenStatesItems(dynamoDBClient);
      expect(resultBefore).toEqual([]);

      await upsertTokenApiClient(clientKidEntry, dynamoDBClient);

      const resultAfter = await readAllTokenStatesItems(dynamoDBClient);
      expect(resultAfter).toEqual([clientKidEntry]);
    });
    it("update", async () => {
      const clientKidEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenStatesClientEntry(),
        clientKind: clientKindTokenStates.api,
      };
      await writeTokenStatesApiClient(clientKidEntry, dynamoDBClient);

      const updatedEntry: TokenGenerationStatesApiClient = {
        ...clientKidEntry,
        clientKind: clientKindTokenStates.api,
      };
      await upsertTokenApiClient(updatedEntry, dynamoDBClient);

      const resultAfter = await readAllTokenStatesItems(dynamoDBClient);
      expect(resultAfter).toEqual([updatedEntry]);
    });
  });

  it("parsing TokenGenerationStatesGenericClient", () => {
    const clientKidEntry: TokenGenerationStatesApiClient = {
      ...getMockTokenStatesClientEntry(),
    };
    const entries1 = z
      .array(TokenGenerationStatesGenericClient)
      .safeParse([clientKidEntry]);

    expect(entries1.data![0]).toEqual(clientKidEntry);

    const clientKidPurposeEntry: TokenGenerationStatesConsumerClient = {
      ...getMockTokenStatesConsumerClient(),
    };
    const entries2 = z
      .array(TokenGenerationStatesGenericClient)
      .safeParse([clientKidPurposeEntry]);

    expect(entries2.data![0]).toEqual(clientKidPurposeEntry);

    const clientId = generateId<ClientId>();
    const clientKidPurposeEntryWithUndefined: TokenGenerationStatesConsumerClient =
      {
        PK: makeTokenGenerationStatesClientKidPurposePK({
          clientId,
          kid: "kid",
          purposeId: generateId<PurposeId>(),
        }),
        consumerId: generateId(),
        clientKind: clientKindTokenStates.consumer,
        publicKey: "publicKey",
        GSIPK_clientId: generateId<ClientId>(),
        GSIPK_kid: unsafeBrandId<GSIPKKid>("kid"),
        updatedAt: new Date().toISOString(),
      };
    const entries3 = z
      .array(TokenGenerationStatesGenericClient)
      .safeParse([clientKidPurposeEntryWithUndefined]);

    expect(entries3.data![0]).toEqual(clientKidPurposeEntryWithUndefined);
  });

  it("updateTokenDataForSecondRetrieval", async () => {
    const consumerId = generateId<TenantId>();
    const descriptor = getMockDescriptor();
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
    };
    const purpose: Purpose = {
      ...getMockPurpose(),
      consumerId,
      eserviceId: eservice.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };
    const key = getMockKey();
    const client: Client = {
      ...getMockClient(),
      consumerId,
      keys: [key],
      purposes: [purpose.id],
    };
    const agreement: Agreement = {
      ...getMockAgreement(),
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
    };

    const tokenClientKidPurposePK = makeTokenGenerationStatesClientKidPurposePK(
      {
        clientId: client.id,
        kid: key.kid,
        purposeId: purpose.id,
      }
    );
    const tokenClientPurposeEntry: TokenGenerationStatesConsumerClient = {
      ...getMockTokenStatesConsumerClient(tokenClientKidPurposePK),
      consumerId,
      GSIPK_clientId: client.id,
      GSIPK_kid: makeGSIPKKid(key.kid),
      GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
        clientId: client.id,
        purposeId: purpose.id,
      }),
      GSIPK_purposeId: purpose.id,
      purposeVersionId: purpose.versions[0].id,
      descriptorAudience: descriptor.audience,
      GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId: eservice.id,
      }),
      GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      }),
    };
    await writeTokenStatesConsumerClient(
      tokenClientPurposeEntry,
      dynamoDBClient
    );

    const platformPurposeEntry: PlatformStatesPurposeEntry = {
      PK: makePlatformStatesPurposePK(purpose.id),
      version: 1,
      state: itemState.inactive,
      updatedAt: new Date().toISOString(),
      purposeVersionId: purpose.versions[0].id,
      purposeEserviceId: eservice.id,
      purposeConsumerId: consumerId,
    };

    const platformAgreementEntry: PlatformStatesAgreementEntry = {
      PK: makePlatformStatesAgreementPK(agreement.id),
      version: 1,
      state: itemState.inactive,
      updatedAt: new Date().toISOString(),
      GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId: eservice.id,
      }),
      GSISK_agreementTimestamp: new Date().toISOString(),
      agreementDescriptorId: agreement.descriptorId,
    };

    const platformCatalogEntry: PlatformStatesCatalogEntry = {
      PK: makePlatformStatesEServiceDescriptorPK({
        eserviceId: purpose.eserviceId,
        descriptorId: descriptor.id,
      }),
      state: itemState.inactive,
      descriptorAudience: ["pagopa.it"],
      descriptorVoucherLifespan: descriptor.voucherLifespan,
      version: 2,
      updatedAt: new Date().toISOString(),
    };

    await updateTokenDataForSecondRetrieval({
      dynamoDBClient,
      entry: tokenClientPurposeEntry,
      purposeEntry: platformPurposeEntry,
      agreementEntry: platformAgreementEntry,
      catalogEntry: platformCatalogEntry,
    });

    const retrievedTokenEntries = await readAllTokenStatesItems(dynamoDBClient);
    const expectedTokenClientPurposeEntry: TokenGenerationStatesConsumerClient =
      {
        ...tokenClientPurposeEntry,
        purposeState: itemState.inactive,
        agreementState: itemState.inactive,
        descriptorState: itemState.inactive,
      };
    expect(retrievedTokenEntries).toHaveLength(1);
    expect(retrievedTokenEntries[0]).toEqual(expectedTokenClientPurposeEntry);
  });
});
