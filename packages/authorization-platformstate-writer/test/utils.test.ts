/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockAgreementEntry,
  getMockPlatformStatesClientEntry,
  getMockTokenStatesClientEntry,
  getMockTokenStatesClientPurposeEntry,
  readAllPlatformStateItems,
  readAllTokenStateItems,
  writeCatalogEntry,
  writePlatformAgreementEntry,
  writePlatformPurposeEntry,
  writeTokenStateEntry,
} from "pagopa-interop-commons-test";
import {
  AgreementId,
  ClientId,
  clientKindTokenStates,
  DescriptorId,
  EServiceId,
  generateId,
  GSIPKKid,
  itemState,
  makeGSIPKClientIdPurposeId,
  makeGSIPKConsumerIdEServiceId,
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
  PurposeId,
  TenantId,
  TokenGenerationStatesClientEntry,
  TokenGenerationStatesClientPurposeEntry,
  TokenGenerationStatesGenericEntry,
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
  cleanClientPurposeIdsInPlatformStatesEntry,
  convertEntriesToClientKidInTokenGenerationStates,
  deleteClientEntryFromPlatformStates,
  deleteClientEntryFromTokenGenerationStatesTable,
  deleteEntriesFromTokenStatesByClient,
  deleteEntriesFromTokenStatesByKid,
  deleteEntriesWithClientAndPurposeFromTokenGenerationStatesTable,
  readClientEntriesInTokenGenerationStates,
  readClientEntry,
  readPlatformAgreementEntryByGSIPKConsumerIdEServiceId,
  retrievePlatformStatesByPurpose,
  upsertPlatformClientEntry,
  upsertTokenClientKidEntry,
  upsertTokenStateClientPurposeEntry,
  writeClientEntry,
  writeTokenStateClientEntry,
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
    const clientEntry: TokenGenerationStatesClientEntry = {
      ...getMockTokenStatesClientEntry(),
      GSIPK_kid: kid,
    };

    const clientPurposeEntry: TokenGenerationStatesClientPurposeEntry = {
      ...getMockTokenStatesClientPurposeEntry(),
      GSIPK_kid: kid,
    };

    const otherClientPurposeEntry: TokenGenerationStatesClientPurposeEntry = {
      ...getMockTokenStatesClientPurposeEntry(),
    };

    await writeTokenStateClientEntry(clientEntry, dynamoDBClient);
    await writeTokenStateEntry(clientPurposeEntry, dynamoDBClient);
    await writeTokenStateEntry(otherClientPurposeEntry, dynamoDBClient);

    await deleteEntriesFromTokenStatesByKid(kid, dynamoDBClient);

    const result = await readAllTokenStateItems(dynamoDBClient);
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

    await writeClientEntry(clientEntry1, dynamoDBClient);
    await writeClientEntry(clientEntry2, dynamoDBClient);

    await deleteClientEntryFromPlatformStates(pk1, dynamoDBClient);

    const res = await readAllPlatformStateItems(dynamoDBClient);

    expect(res).toEqual([clientEntry2]);
  });

  it("deleteEntriesFromTokenStatesByClient", async () => {
    const GSIPK_clientId = generateId<ClientId>();

    const clientEntry: TokenGenerationStatesClientEntry = {
      ...getMockTokenStatesClientEntry(),
      GSIPK_clientId,
    };

    const clientPurposeEntry: TokenGenerationStatesClientPurposeEntry = {
      ...getMockTokenStatesClientPurposeEntry(),
      GSIPK_clientId,
    };

    const otherClientPurposeEntry: TokenGenerationStatesClientPurposeEntry = {
      ...getMockTokenStatesClientPurposeEntry(),
    };
    await writeTokenStateClientEntry(clientEntry, dynamoDBClient);
    await writeTokenStateEntry(clientPurposeEntry, dynamoDBClient);
    await writeTokenStateEntry(otherClientPurposeEntry, dynamoDBClient);

    await deleteEntriesFromTokenStatesByClient(GSIPK_clientId, dynamoDBClient);

    const result = await readAllTokenStateItems(dynamoDBClient);
    expect(result).toEqual([otherClientPurposeEntry]);
  });

  describe("deleteClientEntryFromTokenGenerationStatesTable", () => {
    it("clientKid entry", async () => {
      const clientEntry: TokenGenerationStatesClientEntry = {
        ...getMockTokenStatesClientEntry(),
      };

      const clientPurposeEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(),
      };

      await writeTokenStateClientEntry(clientEntry, dynamoDBClient);
      await writeTokenStateEntry(clientPurposeEntry, dynamoDBClient);

      await deleteClientEntryFromTokenGenerationStatesTable(
        clientEntry,
        dynamoDBClient
      );

      const result = await readAllTokenStateItems(dynamoDBClient);
      expect(result).toEqual([clientPurposeEntry]);
    });
    it("clientKidPurpose entry", async () => {
      const clientEntry: TokenGenerationStatesClientEntry = {
        ...getMockTokenStatesClientEntry(),
      };

      const clientPurposeEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(),
      };

      await writeTokenStateClientEntry(clientEntry, dynamoDBClient);
      await writeTokenStateEntry(clientPurposeEntry, dynamoDBClient);

      await deleteClientEntryFromTokenGenerationStatesTable(
        clientPurposeEntry,
        dynamoDBClient
      );

      const result = await readAllTokenStateItems(dynamoDBClient);
      expect(result).toEqual([clientEntry]);
    });
  });

  it("readClientEntry", async () => {
    const clientEntry1 = getMockPlatformStatesClientEntry();

    const clientEntry2 = getMockPlatformStatesClientEntry();

    await writeClientEntry(clientEntry1, dynamoDBClient);
    await writeClientEntry(clientEntry2, dynamoDBClient);

    const res = await readClientEntry(clientEntry1.PK, dynamoDBClient);

    expect(res).toEqual(clientEntry1);
  });

  it("deleteEntriesWithClientAndPurposeFromTokenGenerationStatesTable", async () => {
    const GSIPK_clientId_purposeId = makeGSIPKClientIdPurposeId({
      clientId: generateId(),
      purposeId: generateId(),
    });
    const clientPurposeEntry1: TokenGenerationStatesClientPurposeEntry = {
      ...getMockTokenStatesClientPurposeEntry(),
      GSIPK_clientId_purposeId,
    };

    const clientPurposeEntry2: TokenGenerationStatesClientPurposeEntry = {
      ...getMockTokenStatesClientPurposeEntry(),
      GSIPK_clientId_purposeId,
    };

    const clientPurposeEntry3 = getMockTokenStatesClientPurposeEntry();

    await writeTokenStateEntry(clientPurposeEntry1, dynamoDBClient);
    await writeTokenStateEntry(clientPurposeEntry2, dynamoDBClient);
    await writeTokenStateEntry(clientPurposeEntry3, dynamoDBClient);

    await deleteEntriesWithClientAndPurposeFromTokenGenerationStatesTable(
      GSIPK_clientId_purposeId,
      dynamoDBClient
    );

    const result = await readAllTokenStateItems(dynamoDBClient);
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
    const clientKidPurposeEntry1: TokenGenerationStatesClientPurposeEntry = {
      ...getMockTokenStatesClientPurposeEntry(pk1),
      GSIPK_clientId_purposeId,
      GSIPK_clientId: clientId,
      GSIPK_kid: unsafeBrandId<GSIPKKid>(kid1),
    };

    const pk2 = makeTokenGenerationStatesClientKidPurposePK({
      clientId,
      kid: kid2,
      purposeId,
    });
    const clientKidPurposeEntry2: TokenGenerationStatesClientPurposeEntry = {
      ...getMockTokenStatesClientPurposeEntry(pk2),
      GSIPK_clientId_purposeId,
      GSIPK_clientId: clientId,
      GSIPK_kid: unsafeBrandId<GSIPKKid>(kid2),
    };

    const clientKidPurposeEntry3 = getMockTokenStatesClientPurposeEntry();

    await writeTokenStateEntry(clientKidPurposeEntry1, dynamoDBClient);
    await writeTokenStateEntry(clientKidPurposeEntry2, dynamoDBClient);
    await writeTokenStateEntry(clientKidPurposeEntry3, dynamoDBClient);

    await convertEntriesToClientKidInTokenGenerationStates(
      GSIPK_clientId_purposeId,
      dynamoDBClient
    );

    const expectedEntry1: TokenGenerationStatesClientEntry = {
      consumerId: clientKidPurposeEntry1.consumerId,
      updatedAt: new Date().toISOString(),
      PK: makeTokenGenerationStatesClientKidPK({ clientId, kid: kid1 }),
      clientKind: clientKindTokenStates.consumer,
      publicKey: clientKidPurposeEntry1.publicKey,
      GSIPK_clientId: clientId,
      GSIPK_kid: unsafeBrandId<GSIPKKid>(kid1),
    };

    const expectedEntry2: TokenGenerationStatesClientEntry = {
      consumerId: clientKidPurposeEntry2.consumerId,
      updatedAt: new Date().toISOString(),
      PK: makeTokenGenerationStatesClientKidPK({ clientId, kid: kid2 }),
      clientKind: "CONSUMER",
      publicKey: clientKidPurposeEntry1.publicKey,
      GSIPK_clientId: clientId,
      GSIPK_kid: unsafeBrandId<GSIPKKid>(kid2),
    };

    const result = await readAllTokenStateItems(dynamoDBClient);
    expect(result).toEqual(
      expect.arrayContaining([
        expectedEntry2,
        expectedEntry1,
        clientKidPurposeEntry3,
      ])
    );
  });

  describe("writeTokenStateClientEntry", () => {
    it("should succeed if the entry doesn't exist", async () => {
      const clientEntry = getMockTokenStatesClientEntry();
      await writeTokenStateClientEntry(clientEntry, dynamoDBClient);

      const result = await readAllTokenStateItems(dynamoDBClient);
      expect(result).toEqual([clientEntry]);
    });

    it("shoould throw error if the entry already exists", async () => {
      const clientEntry = getMockTokenStatesClientEntry();
      await writeTokenStateClientEntry(clientEntry, dynamoDBClient);

      expect(
        writeTokenStateClientEntry(clientEntry, dynamoDBClient)
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
      ...getMockAgreementEntry(pk1, GSIPK_consumerId_eserviceId),
      GSISK_agreementTimestamp: threeHoursAgo.toISOString(),
    };

    const agreementEntry2: PlatformStatesAgreementEntry = {
      ...getMockAgreementEntry(pk2, GSIPK_consumerId_eserviceId),
      GSISK_agreementTimestamp: new Date().toISOString(),
    };

    const agreementEntry3 = getMockAgreementEntry(pk3);

    await writePlatformAgreementEntry(agreementEntry1, dynamoDBClient);
    await writePlatformAgreementEntry(agreementEntry2, dynamoDBClient);
    await writePlatformAgreementEntry(agreementEntry3, dynamoDBClient);

    const res = await readPlatformAgreementEntryByGSIPKConsumerIdEServiceId(
      dynamoDBClient,
      GSIPK_consumerId_eserviceId
    );

    expect(res).toEqual(agreementEntry2);
  });

  describe("upsertTokenStateClientPurposeEntry", () => {
    it("write", async () => {
      const clientKidPurposeEntry = getMockTokenStatesClientPurposeEntry();

      const resultBefore = await readAllTokenStateItems(dynamoDBClient);
      expect(resultBefore).toEqual([]);

      await upsertTokenStateClientPurposeEntry(
        clientKidPurposeEntry,
        dynamoDBClient
      );

      const resultAfter = await readAllTokenStateItems(dynamoDBClient);
      expect(resultAfter).toEqual([clientKidPurposeEntry]);
    });
    it("update", async () => {
      const clientKidPurposeEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(),
        descriptorState: itemState.active,
      };
      await writeTokenStateEntry(clientKidPurposeEntry, dynamoDBClient);

      const updatedEntry: TokenGenerationStatesClientPurposeEntry = {
        ...clientKidPurposeEntry,
        descriptorState: itemState.inactive,
      };
      await upsertTokenStateClientPurposeEntry(updatedEntry, dynamoDBClient);

      const resultAfter = await readAllTokenStateItems(dynamoDBClient);
      expect(resultAfter).toEqual([updatedEntry]);
    });
  });

  it("readClientEntriesInTokenGenerationStates", async () => {
    const clientId = generateId<ClientId>();
    const pk1 = makeTokenGenerationStatesClientKidPK({ clientId, kid: "" });
    const pk2 = makeTokenGenerationStatesClientKidPurposePK({
      clientId,
      kid: "",
      purposeId: generateId<PurposeId>(),
    });

    const GSIPK_clientId = clientId;

    const clientKidEntry: TokenGenerationStatesClientEntry = {
      ...getMockTokenStatesClientEntry(pk1),
      GSIPK_clientId,
    };

    const clientKidPurposeEntry: TokenGenerationStatesClientPurposeEntry = {
      ...getMockTokenStatesClientPurposeEntry(pk2),
      GSIPK_clientId,
    };

    await writeTokenStateClientEntry(clientKidEntry, dynamoDBClient);
    await writeTokenStateEntry(clientKidPurposeEntry, dynamoDBClient);

    const res = await readClientEntriesInTokenGenerationStates(
      GSIPK_clientId,
      dynamoDBClient
    );

    expect(res).toEqual(
      expect.arrayContaining([clientKidEntry, clientKidPurposeEntry])
    );
  });

  it("cleanClientPurposeIdsInPlatformStatesEntry", async () => {
    const clientEntry1: PlatformStatesClientEntry = {
      ...getMockPlatformStatesClientEntry(),
      clientPurposesIds: [generateId(), generateId()],
    };
    const clientEntry2: PlatformStatesClientEntry = {
      ...getMockPlatformStatesClientEntry(),
      clientPurposesIds: [generateId(), generateId()],
    };

    await writeClientEntry(clientEntry1, dynamoDBClient);
    await writeClientEntry(clientEntry2, dynamoDBClient);

    await cleanClientPurposeIdsInPlatformStatesEntry(
      dynamoDBClient,
      clientEntry1.PK,
      clientEntry1.version + 1
    );

    const res = await readAllPlatformStateItems(dynamoDBClient);
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
      ...getMockAgreementEntry(agreementPK),
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

    await writeCatalogEntry(catalogEntry, dynamoDBClient);

    const res = await retrievePlatformStatesByPurpose(
      dynamoDBClient,
      purposeId
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

      const resultBefore = await readAllPlatformStateItems(dynamoDBClient);
      expect(resultBefore).toEqual([]);

      await upsertPlatformClientEntry(dynamoDBClient, clientEntry);

      const resultAfter = await readAllPlatformStateItems(dynamoDBClient);
      expect(resultAfter).toEqual([clientEntry]);
    });
    it("update", async () => {
      const clientEntry: PlatformStatesClientEntry = {
        ...getMockPlatformStatesClientEntry(),
        clientKind: clientKindTokenStates.consumer,
      };

      await writeClientEntry(clientEntry, dynamoDBClient);

      const updatedEntry: PlatformStatesClientEntry = {
        ...clientEntry,
        clientKind: clientKindTokenStates.api,
      };
      await upsertPlatformClientEntry(dynamoDBClient, updatedEntry);

      const resultAfter = await readAllPlatformStateItems(dynamoDBClient);
      expect(resultAfter).toEqual([updatedEntry]);
    });
  });

  describe("upsertTokenClientKidEntry", () => {
    it("write", async () => {
      const clientKidEntry = getMockTokenStatesClientEntry();

      const resultBefore = await readAllTokenStateItems(dynamoDBClient);
      expect(resultBefore).toEqual([]);

      await upsertTokenClientKidEntry(dynamoDBClient, clientKidEntry);

      const resultAfter = await readAllTokenStateItems(dynamoDBClient);
      expect(resultAfter).toEqual([clientKidEntry]);
    });
    it("update", async () => {
      const clientKidEntry: TokenGenerationStatesClientEntry = {
        ...getMockTokenStatesClientEntry(),
        clientKind: clientKindTokenStates.consumer,
      };
      await writeTokenStateClientEntry(clientKidEntry, dynamoDBClient);

      const updatedEntry: TokenGenerationStatesClientEntry = {
        ...clientKidEntry,
        clientKind: clientKindTokenStates.api,
      };
      await upsertTokenClientKidEntry(dynamoDBClient, updatedEntry);

      const resultAfter = await readAllTokenStateItems(dynamoDBClient);
      expect(resultAfter).toEqual([updatedEntry]);
    });
  });

  it("parsing TokenGenerationStatesGenericEntry", () => {
    const clientKidEntry: TokenGenerationStatesClientEntry = {
      ...getMockTokenStatesClientEntry(),
    };
    const entries1 = z
      .array(TokenGenerationStatesGenericEntry)
      .safeParse([clientKidEntry]);

    expect(entries1.data![0]).toEqual(clientKidEntry);

    const clientKidPurposeEntry: TokenGenerationStatesClientPurposeEntry = {
      ...getMockTokenStatesClientPurposeEntry(),
    };
    const entries2 = z
      .array(TokenGenerationStatesGenericEntry)
      .safeParse([clientKidPurposeEntry]);

    expect(entries2.data![0]).toEqual(clientKidPurposeEntry);

    const clientId = generateId<ClientId>();
    const clientKidPurposeEntryWithUndefined: TokenGenerationStatesClientPurposeEntry =
      {
        PK: makeTokenGenerationStatesClientKidPurposePK({
          clientId,
          kid: "kid",
          purposeId: generateId<PurposeId>(),
        }),
        consumerId: generateId(),
        clientKind: clientKindTokenStates.api,
        publicKey: "publicKey",
        GSIPK_clientId: generateId<ClientId>(),
        GSIPK_kid: unsafeBrandId<GSIPKKid>("kid"),
        updatedAt: new Date().toISOString(),
      };
    const entries3 = z
      .array(TokenGenerationStatesGenericEntry)
      .safeParse([clientKidPurposeEntryWithUndefined]);

    expect(entries3.data![0]).toEqual(clientKidPurposeEntryWithUndefined);
  });
});
