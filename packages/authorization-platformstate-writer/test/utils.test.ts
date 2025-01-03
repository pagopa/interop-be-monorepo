/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockPlatformStatesAgreementEntry,
  getMockKey,
  getMockPlatformStatesClientEntry,
  getMockPurposeVersion,
  getMockTokenGenStatesApiClient,
  getMockTokenGenStatesConsumerClient,
  getMockPurpose,
  getMockClient,
  readAllPlatformStatesItems,
  readAllTokenGenStatesItems,
  writePlatformCatalogEntry,
  writePlatformAgreementEntry,
  writePlatformPurposeEntry,
  writeTokenGenStatesConsumerClient,
  getMockAgreement,
  getMockDescriptor,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementId,
  Client,
  ClientId,
  clientKindTokenGenStates,
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
  PlatformStatesAgreementGSIAgreement,
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
  TokenGenStatesConsumerClientGSIClient,
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
import { z } from "zod";
import { genericLogger } from "pagopa-interop-commons";
import {
  setClientPurposeIdsInPlatformStatesEntry,
  convertEntriesToClientKidInTokenGenerationStates,
  deleteClientEntryFromPlatformStates,
  readConsumerClientEntriesInTokenGenerationStates,
  readPlatformAgreementEntryByGSIPKConsumerIdEServiceId,
  retrievePlatformStatesByPurpose,
  updateTokenGenStatesDataForSecondRetrieval,
  upsertPlatformClientEntry,
  writeTokenGenStatesApiClient,
  deleteEntriesFromTokenGenStatesByKid,
  writePlatformClientEntry,
  deleteEntriesFromTokenGenStatesByClientId,
  deleteClientEntryFromTokenGenerationStates,
  readPlatformClientEntry,
  deleteEntriesFromTokenGenStatesByGSIPKClientIdPurposeId,
  upsertTokenGenStatesConsumerClient,
  upsertTokenGenStatesApiClient,
} from "../src/utils.js";
import { dynamoDBClient } from "./utils.js";

describe("utils", () => {
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

  it("deleteEntriesFromTokenGenStatesByKid", async () => {
    const kid = unsafeBrandId<GSIPKKid>("mock kid");
    const clientEntry: TokenGenerationStatesApiClient = {
      ...getMockTokenGenStatesApiClient(),
      GSIPK_kid: kid,
    };

    const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient = {
      ...getMockTokenGenStatesConsumerClient(),
      GSIPK_kid: kid,
    };

    const otherConsumerClient: TokenGenerationStatesConsumerClient = {
      ...getMockTokenGenStatesConsumerClient(),
    };

    await writeTokenGenStatesApiClient(clientEntry, dynamoDBClient);
    await writeTokenGenStatesConsumerClient(
      tokenGenStatesConsumerClient,
      dynamoDBClient
    );
    await writeTokenGenStatesConsumerClient(
      otherConsumerClient,
      dynamoDBClient
    );

    await deleteEntriesFromTokenGenStatesByKid(kid, dynamoDBClient);

    const result = await readAllTokenGenStatesItems(dynamoDBClient);
    expect(result).toEqual([otherConsumerClient]);
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

  it("deleteEntriesFromTokenGenStatesByClientId", async () => {
    const GSIPK_clientId = generateId<ClientId>();

    const clientEntry: TokenGenerationStatesApiClient = {
      ...getMockTokenGenStatesApiClient(),
      GSIPK_clientId,
    };

    const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient = {
      ...getMockTokenGenStatesConsumerClient(),
      GSIPK_clientId,
    };

    const otherConsumerClient: TokenGenerationStatesConsumerClient = {
      ...getMockTokenGenStatesConsumerClient(),
    };
    await writeTokenGenStatesApiClient(clientEntry, dynamoDBClient);
    await writeTokenGenStatesConsumerClient(
      tokenGenStatesConsumerClient,
      dynamoDBClient
    );
    await writeTokenGenStatesConsumerClient(
      otherConsumerClient,
      dynamoDBClient
    );

    await deleteEntriesFromTokenGenStatesByClientId(
      GSIPK_clientId,
      dynamoDBClient
    );

    const result = await readAllTokenGenStatesItems(dynamoDBClient);
    expect(result).toEqual([otherConsumerClient]);
  });

  describe("deleteClientEntryFromTokenGenerationStates", () => {
    it("tokenGenStatesApiClient", async () => {
      const clientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(),
      };

      const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
        };

      await writeTokenGenStatesApiClient(clientEntry, dynamoDBClient);
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient,
        dynamoDBClient
      );

      await deleteClientEntryFromTokenGenerationStates(
        clientEntry.PK,
        dynamoDBClient
      );

      const result = await readAllTokenGenStatesItems(dynamoDBClient);
      expect(result).toEqual([tokenGenStatesConsumerClient]);
    });
    it("tokenGenStatesConsumerClient", async () => {
      const clientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(),
      };

      const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
        };

      await writeTokenGenStatesApiClient(clientEntry, dynamoDBClient);
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient,
        dynamoDBClient
      );

      await deleteClientEntryFromTokenGenerationStates(
        tokenGenStatesConsumerClient.PK,
        dynamoDBClient
      );

      const result = await readAllTokenGenStatesItems(dynamoDBClient);
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

  it("deleteEntriesFromTokenGenStatesByGSIPKClientIdPurposeId", async () => {
    const GSIPK_clientId_purposeId = makeGSIPKClientIdPurposeId({
      clientId: generateId(),
      purposeId: generateId(),
    });
    const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient = {
      ...getMockTokenGenStatesConsumerClient(),
      GSIPK_clientId_purposeId,
    };

    const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient = {
      ...getMockTokenGenStatesConsumerClient(),
      GSIPK_clientId_purposeId,
    };

    const tokenGenStatesConsumerClient3 = getMockTokenGenStatesConsumerClient();

    await writeTokenGenStatesConsumerClient(
      tokenGenStatesConsumerClient1,
      dynamoDBClient
    );
    await writeTokenGenStatesConsumerClient(
      tokenGenStatesConsumerClient2,
      dynamoDBClient
    );
    await writeTokenGenStatesConsumerClient(
      tokenGenStatesConsumerClient3,
      dynamoDBClient
    );

    await deleteEntriesFromTokenGenStatesByGSIPKClientIdPurposeId(
      GSIPK_clientId_purposeId,
      dynamoDBClient
    );

    const result = await readAllTokenGenStatesItems(dynamoDBClient);
    expect(result).toEqual([tokenGenStatesConsumerClient3]);
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
    const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient = {
      ...getMockTokenGenStatesConsumerClient(pk1),
      GSIPK_clientId_purposeId,
      GSIPK_clientId: clientId,
      GSIPK_kid: unsafeBrandId<GSIPKKid>(kid1),
    };

    const pk2 = makeTokenGenerationStatesClientKidPurposePK({
      clientId,
      kid: kid2,
      purposeId,
    });
    const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient = {
      ...getMockTokenGenStatesConsumerClient(pk2),
      GSIPK_clientId_purposeId,
      GSIPK_clientId: clientId,
      GSIPK_kid: unsafeBrandId<GSIPKKid>(kid2),
    };

    const tokenGenStatesConsumerClient3 = getMockTokenGenStatesConsumerClient();

    await writeTokenGenStatesConsumerClient(
      tokenGenStatesConsumerClient1,
      dynamoDBClient
    );
    await writeTokenGenStatesConsumerClient(
      tokenGenStatesConsumerClient2,
      dynamoDBClient
    );
    await writeTokenGenStatesConsumerClient(
      tokenGenStatesConsumerClient3,
      dynamoDBClient
    );

    await convertEntriesToClientKidInTokenGenerationStates(
      GSIPK_clientId_purposeId,
      dynamoDBClient
    );

    const expectedEntry1: TokenGenerationStatesConsumerClient = {
      consumerId: tokenGenStatesConsumerClient1.consumerId,
      updatedAt: new Date().toISOString(),
      PK: makeTokenGenerationStatesClientKidPK({ clientId, kid: kid1 }),
      clientKind: clientKindTokenGenStates.consumer,
      publicKey: tokenGenStatesConsumerClient1.publicKey,
      GSIPK_clientId: clientId,
      GSIPK_kid: unsafeBrandId<GSIPKKid>(kid1),
    };

    const expectedEntry2: TokenGenerationStatesConsumerClient = {
      consumerId: tokenGenStatesConsumerClient2.consumerId,
      updatedAt: new Date().toISOString(),
      PK: makeTokenGenerationStatesClientKidPK({ clientId, kid: kid2 }),
      clientKind: "CONSUMER",
      publicKey: tokenGenStatesConsumerClient1.publicKey,
      GSIPK_clientId: clientId,
      GSIPK_kid: unsafeBrandId<GSIPKKid>(kid2),
    };

    const result = await readAllTokenGenStatesItems(dynamoDBClient);
    expect(result).toEqual(
      expect.arrayContaining([
        expectedEntry2,
        expectedEntry1,
        tokenGenStatesConsumerClient3,
      ])
    );
  });

  describe("writeTokenGenStatesApiClient", () => {
    it("should succeed if the entry doesn't exist", async () => {
      const clientEntry = getMockTokenGenStatesApiClient();
      await writeTokenGenStatesApiClient(clientEntry, dynamoDBClient);

      const result = await readAllTokenGenStatesItems(dynamoDBClient);
      expect(result).toEqual([clientEntry]);
    });

    it("should throw error if the entry already exists", async () => {
      const clientEntry = getMockTokenGenStatesApiClient();
      await writeTokenGenStatesApiClient(clientEntry, dynamoDBClient);

      expect(
        writeTokenGenStatesApiClient(clientEntry, dynamoDBClient)
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

    expect(res).toEqual(
      PlatformStatesAgreementGSIAgreement.parse(agreementEntry2)
    );
  });

  describe("upsertTokenGenStatesConsumerClient", () => {
    it("write", async () => {
      const tokenGenStatesConsumerClient =
        getMockTokenGenStatesConsumerClient();

      const resultBefore = await readAllTokenGenStatesItems(dynamoDBClient);
      expect(resultBefore).toEqual([]);

      await upsertTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient,
        dynamoDBClient
      );

      const resultAfter = await readAllTokenGenStatesItems(dynamoDBClient);
      expect(resultAfter).toEqual([tokenGenStatesConsumerClient]);
    });
    it("update", async () => {
      const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          descriptorState: itemState.active,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient,
        dynamoDBClient
      );

      const updatedEntry: TokenGenerationStatesConsumerClient = {
        ...tokenGenStatesConsumerClient,
        descriptorState: itemState.inactive,
      };
      await upsertTokenGenStatesConsumerClient(updatedEntry, dynamoDBClient);

      const resultAfter = await readAllTokenGenStatesItems(dynamoDBClient);
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

    const tokenGenStatesConsumerClientWithoutPurpose: TokenGenerationStatesConsumerClient =
      {
        ...getMockTokenGenStatesConsumerClient(pk1),
        GSIPK_clientId,
      };

    const tokenGenStatesConsumerClientWithPurpose: TokenGenerationStatesConsumerClient =
      {
        ...getMockTokenGenStatesConsumerClient(pk2),
        GSIPK_clientId,
      };

    await writeTokenGenStatesConsumerClient(
      tokenGenStatesConsumerClientWithoutPurpose,
      dynamoDBClient
    );
    await writeTokenGenStatesConsumerClient(
      tokenGenStatesConsumerClientWithPurpose,
      dynamoDBClient
    );

    const res = await readConsumerClientEntriesInTokenGenerationStates(
      GSIPK_clientId,
      dynamoDBClient
    );

    expect(res).toEqual(
      expect.arrayContaining([
        TokenGenStatesConsumerClientGSIClient.parse(
          tokenGenStatesConsumerClientWithoutPurpose
        ),
        TokenGenStatesConsumerClientGSIClient.parse(
          tokenGenStatesConsumerClientWithPurpose
        ),
      ])
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
      dynamoDBClient,
      genericLogger
    );

    expect(res).toEqual({
      purposeEntry,
      agreementEntry: PlatformStatesAgreementGSIAgreement.parse(agreementEntry),
      catalogEntry,
    });
  });

  describe("upsertPlatformClientEntry", () => {
    it("write", async () => {
      const clientEntry: PlatformStatesClientEntry = {
        ...getMockPlatformStatesClientEntry(),
        clientKind: clientKindTokenGenStates.consumer,
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
        clientKind: clientKindTokenGenStates.consumer,
      };

      await writePlatformClientEntry(clientEntry, dynamoDBClient);

      const updatedEntry: PlatformStatesClientEntry = {
        ...clientEntry,
        clientKind: clientKindTokenGenStates.api,
      };
      await upsertPlatformClientEntry(updatedEntry, dynamoDBClient);

      const resultAfter = await readAllPlatformStatesItems(dynamoDBClient);
      expect(resultAfter).toEqual([updatedEntry]);
    });
  });

  describe("upsertTokenApiClient", () => {
    it("write", async () => {
      const tokenGenStatesApiClient = getMockTokenGenStatesApiClient();

      const resultBefore = await readAllTokenGenStatesItems(dynamoDBClient);
      expect(resultBefore).toEqual([]);

      await upsertTokenGenStatesApiClient(
        tokenGenStatesApiClient,
        dynamoDBClient
      );

      const resultAfter = await readAllTokenGenStatesItems(dynamoDBClient);
      expect(resultAfter).toEqual([tokenGenStatesApiClient]);
    });
    it("update", async () => {
      const tokenGenStatesApiClient: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(),
        clientKind: clientKindTokenGenStates.api,
      };
      await writeTokenGenStatesApiClient(
        tokenGenStatesApiClient,
        dynamoDBClient
      );

      const updatedEntry: TokenGenerationStatesApiClient = {
        ...tokenGenStatesApiClient,
        clientKind: clientKindTokenGenStates.api,
      };
      await upsertTokenGenStatesApiClient(updatedEntry, dynamoDBClient);

      const resultAfter = await readAllTokenGenStatesItems(dynamoDBClient);
      expect(resultAfter).toEqual([updatedEntry]);
    });
  });

  it("parsing TokenGenerationStatesGenericClient", () => {
    const tokenGenStatesApiClient: TokenGenerationStatesApiClient = {
      ...getMockTokenGenStatesApiClient(),
    };
    const entries1 = z
      .array(TokenGenerationStatesGenericClient)
      .safeParse([tokenGenStatesApiClient]);

    expect(entries1.data![0]).toEqual(tokenGenStatesApiClient);

    const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient = {
      ...getMockTokenGenStatesConsumerClient(),
    };
    const entries2 = z
      .array(TokenGenerationStatesGenericClient)
      .safeParse([tokenGenStatesConsumerClient]);

    expect(entries2.data![0]).toEqual(tokenGenStatesConsumerClient);

    const clientId = generateId<ClientId>();
    const tokenGenStatesConsumerClientWithUndefined: TokenGenerationStatesConsumerClient =
      {
        PK: makeTokenGenerationStatesClientKidPurposePK({
          clientId,
          kid: "kid",
          purposeId: generateId<PurposeId>(),
        }),
        consumerId: generateId(),
        clientKind: clientKindTokenGenStates.consumer,
        publicKey: "publicKey",
        GSIPK_clientId: generateId<ClientId>(),
        GSIPK_kid: unsafeBrandId<GSIPKKid>("kid"),
        updatedAt: new Date().toISOString(),
      };
    const entries3 = z
      .array(TokenGenerationStatesGenericClient)
      .safeParse([tokenGenStatesConsumerClientWithUndefined]);

    expect(entries3.data![0]).toEqual(
      tokenGenStatesConsumerClientWithUndefined
    );
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
    const tokenConsumerClient: TokenGenerationStatesConsumerClient = {
      ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK),
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
    await writeTokenGenStatesConsumerClient(
      tokenConsumerClient,
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

    await updateTokenGenStatesDataForSecondRetrieval({
      dynamoDBClient,
      entry: tokenConsumerClient,
      purposeEntry: platformPurposeEntry,
      agreementEntry: platformAgreementEntry,
      catalogEntry: platformCatalogEntry,
    });

    const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
      dynamoDBClient
    );
    const expectedTokenConsumerClient: TokenGenerationStatesConsumerClient = {
      ...tokenConsumerClient,
      purposeState: itemState.inactive,
      agreementState: itemState.inactive,
      descriptorState: itemState.inactive,
    };
    expect(retrievedTokenGenStatesEntries).toHaveLength(1);
    expect(retrievedTokenGenStatesEntries[0]).toEqual(
      expectedTokenConsumerClient
    );
  });
});
