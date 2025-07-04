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
  TokenGenerationStatesApiClient,
  TokenGenerationStatesConsumerClient,
  TokenGenerationStatesGenericClient,
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
  retrievePlatformStatesByPurpose,
  updateTokenGenStatesDataForSecondRetrieval,
  upsertPlatformClientEntry,
  writeTokenGenStatesApiClient,
  deleteEntriesFromTokenGenStatesByClientIdKidV1,
  writePlatformClientEntry,
  deleteClientEntryFromTokenGenerationStates,
  readPlatformClientEntry,
  deleteEntriesFromTokenGenStatesByClientIdPurposeIdV1,
  upsertTokenGenStatesConsumerClient,
  upsertTokenGenStatesApiClient,
  deleteEntriesFromTokenGenStatesByClientIdV2,
  deleteEntriesFromTokenGenStatesByClientIdV1,
  deleteEntriesFromTokenGenStatesByClientIdPurposeIdV2,
  deleteEntriesFromTokenGenStatesByClientIdKidV2,
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

  describe("deleteEntriesFromTokenGenStatesByClientIdKidV1", () => {
    it("ApiClient", async () => {
      const clientId = generateId<ClientId>();
      const kid = "kid";
      const clientIdkid = makeGSIPKClientIdKid({
        clientId,
        kid,
      });

      const apiClientPK = makeTokenGenerationStatesClientKidPK({
        clientId,
        kid,
      });
      const clientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(apiClientPK),
        GSIPK_clientId_kid: clientIdkid,
      };

      const otherApiClient = getMockTokenGenStatesApiClient();

      await writeTokenGenStatesApiClient(
        clientEntry,
        dynamoDBClient,
        genericLogger
      );

      await writeTokenGenStatesApiClient(
        otherApiClient,
        dynamoDBClient,
        genericLogger
      );

      await deleteEntriesFromTokenGenStatesByClientIdKidV1(
        clientId,
        kid,
        dynamoDBClient,
        genericLogger
      );

      const result = await readAllTokenGenStatesItems(dynamoDBClient);
      expect(result).toEqual([otherApiClient]);
    });

    it("ConsumerClient", async () => {
      const clientId = generateId<ClientId>();
      const kid = "kid";
      const purposeId = generateId<PurposeId>();

      const consumerClientPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId,
        kid,
        purposeId,
      });
      const consumerClient: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(consumerClientPK),
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId,
          kid,
        }),
      };

      const otherConsumerClient = getMockTokenGenStatesConsumerClient();

      await writeTokenGenStatesConsumerClient(consumerClient, dynamoDBClient);

      await writeTokenGenStatesConsumerClient(
        otherConsumerClient,
        dynamoDBClient
      );

      await deleteEntriesFromTokenGenStatesByClientIdKidV1(
        clientId,
        kid,
        dynamoDBClient,
        genericLogger
      );

      const result = await readAllTokenGenStatesItems(dynamoDBClient);
      expect(result).toEqual([otherConsumerClient]);
    });
  });

  describe("deleteEntriesFromTokenGenStatesByClientIdKidV2", () => {
    it("ApiClient", async () => {
      const key = getMockKey();

      const client: Client = {
        ...getMockClient(),
        keys: [key],
      };
      const clientIdkid = makeGSIPKClientIdKid({
        clientId: client.id,
        kid: key.kid,
      });

      const apiClientPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: key.kid,
      });
      const clientEntry: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(apiClientPK),
        GSIPK_clientId_kid: clientIdkid,
      };

      const otherApiClient = getMockTokenGenStatesApiClient();

      await writeTokenGenStatesApiClient(
        clientEntry,
        dynamoDBClient,
        genericLogger
      );

      await writeTokenGenStatesApiClient(
        otherApiClient,
        dynamoDBClient,
        genericLogger
      );

      await deleteEntriesFromTokenGenStatesByClientIdKidV2(
        client,
        key.kid,
        dynamoDBClient,
        genericLogger
      );

      const result = await readAllTokenGenStatesItems(dynamoDBClient);
      expect(result).toEqual([otherApiClient]);
    });

    it("ConsumerClient", async () => {
      const key = getMockKey();
      const purposeId = generateId<PurposeId>();

      const client: Client = {
        ...getMockClient(),
        keys: [key],
        purposes: [purposeId],
      };

      const consumerClientPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId: client.id,
        kid: key.kid,
        purposeId,
      });
      const consumerClient: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(consumerClientPK),
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: key.kid,
        }),
      };

      const otherConsumerClient = getMockTokenGenStatesConsumerClient();

      await writeTokenGenStatesConsumerClient(consumerClient, dynamoDBClient);

      await writeTokenGenStatesConsumerClient(
        otherConsumerClient,
        dynamoDBClient
      );

      await deleteEntriesFromTokenGenStatesByClientIdKidV2(
        client,
        key.kid,
        dynamoDBClient,
        genericLogger
      );

      const result = await readAllTokenGenStatesItems(dynamoDBClient);
      expect(result).toEqual([otherConsumerClient]);
    });
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

    await writePlatformClientEntry(clientEntry1, dynamoDBClient, genericLogger);
    await writePlatformClientEntry(clientEntry2, dynamoDBClient, genericLogger);

    await deleteClientEntryFromPlatformStates(
      pk1,
      dynamoDBClient,
      genericLogger
    );

    const res = await readAllPlatformStatesItems(dynamoDBClient);

    expect(res).toEqual([clientEntry2]);
  });

  describe("deleteEntriesFromTokenGenStatesByClientIdV1", () => {
    it("ApiClient", async () => {
      const mockKey1 = getMockKey();
      const mockKey2 = getMockKey();

      const client: Client = {
        ...getMockClient(),
        keys: [mockKey1, mockKey2],
        purposes: [],
      };

      const apiClient1: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(),
        PK: makeTokenGenerationStatesClientKidPK({
          clientId: client.id,
          kid: mockKey1.kid,
        }),
        GSIPK_clientId: client.id,
      };

      const apiClient2: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(),
        PK: makeTokenGenerationStatesClientKidPK({
          clientId: client.id,
          kid: mockKey2.kid,
        }),
        GSIPK_clientId: client.id,
      };

      const otherApiClient: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(),
      };
      await writeTokenGenStatesApiClient(
        apiClient1,
        dynamoDBClient,
        genericLogger
      );
      await writeTokenGenStatesApiClient(
        apiClient2,
        dynamoDBClient,
        genericLogger
      );
      await writeTokenGenStatesApiClient(
        otherApiClient,
        dynamoDBClient,
        genericLogger
      );

      await deleteEntriesFromTokenGenStatesByClientIdV1(
        client.id,
        dynamoDBClient,
        genericLogger
      );

      const result = await readAllTokenGenStatesItems(dynamoDBClient);
      expect(result).toEqual([otherApiClient]);
    });

    it("ConsumerClient", async () => {
      const mockKey1 = getMockKey();
      const mockKey2 = getMockKey();
      const purposeId = generateId<PurposeId>();

      const client: Client = {
        ...getMockClient(),
        keys: [mockKey1, mockKey2],
        purposes: [purposeId],
      };

      const consumerClient1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(),
        PK: makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: mockKey1.kid,
          purposeId,
        }),
        GSIPK_clientId: client.id,
      };

      const consumerClient2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(),
        PK: makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: mockKey2.kid,
          purposeId,
        }),
        GSIPK_clientId: client.id,
      };

      const otherConsumerClient = getMockTokenGenStatesConsumerClient();

      await writeTokenGenStatesConsumerClient(consumerClient1, dynamoDBClient);
      await writeTokenGenStatesConsumerClient(consumerClient2, dynamoDBClient);

      await writeTokenGenStatesConsumerClient(
        otherConsumerClient,
        dynamoDBClient
      );

      await deleteEntriesFromTokenGenStatesByClientIdV1(
        client.id,
        dynamoDBClient,
        genericLogger
      );

      const result = await readAllTokenGenStatesItems(dynamoDBClient);
      expect(result).toEqual([otherConsumerClient]);
    });
  });

  describe("deleteEntriesFromTokenGenStatesByClientIdV2", () => {
    it("ApiClient", async () => {
      const mockKey = getMockKey();
      const mockKey2 = getMockKey();

      const client: Client = {
        ...getMockClient(),
        keys: [mockKey, mockKey2],
        purposes: [],
      };

      const clientEntry: TokenGenerationStatesApiClient = {
        GSIPK_clientId: client.id,
        consumerId: client.consumerId,
        updatedAt: new Date().toISOString(),
        PK: makeTokenGenerationStatesClientKidPK({
          clientId: client.id,
          kid: mockKey.kid,
        }),
        clientKind: clientKindTokenGenStates.api,
        publicKey: "public key",
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: client.id,
          kid: mockKey.kid,
        }),
      };

      const otherApiClient: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(),
      };
      await writeTokenGenStatesApiClient(
        clientEntry,
        dynamoDBClient,
        genericLogger
      );

      await writeTokenGenStatesApiClient(
        otherApiClient,
        dynamoDBClient,
        genericLogger
      );

      await deleteEntriesFromTokenGenStatesByClientIdV2(
        client,
        dynamoDBClient,
        genericLogger
      );

      const result = await readAllTokenGenStatesItems(dynamoDBClient);
      expect(result).toEqual([otherApiClient]);
    });

    it("ConsumerClient", async () => {
      const mockKey = getMockKey();
      const mockKey2 = getMockKey();
      const purposeId = generateId<PurposeId>();

      const client: Client = {
        ...getMockClient(),
        keys: [mockKey, mockKey2],
        purposes: [purposeId],
      };

      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          PK: makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            kid: mockKey.kid,
            purposeId,
          }),
          consumerId: client.consumerId,
        };

      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(),
          PK: makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            kid: mockKey2.kid,
            purposeId,
          }),
          consumerId: client.consumerId,
        };

      const otherConsumerClient: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(),
      };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );
      await writeTokenGenStatesConsumerClient(
        otherConsumerClient,
        dynamoDBClient
      );

      await deleteEntriesFromTokenGenStatesByClientIdV2(
        client,
        dynamoDBClient,
        genericLogger
      );

      const result = await readAllTokenGenStatesItems(dynamoDBClient);
      expect(result).toEqual([otherConsumerClient]);
    });
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

      await writeTokenGenStatesApiClient(
        clientEntry,
        dynamoDBClient,
        genericLogger
      );
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient,
        dynamoDBClient
      );

      await deleteClientEntryFromTokenGenerationStates(
        clientEntry.PK,
        dynamoDBClient,
        genericLogger
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

      await writeTokenGenStatesApiClient(
        clientEntry,
        dynamoDBClient,
        genericLogger
      );
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient,
        dynamoDBClient
      );

      await deleteClientEntryFromTokenGenerationStates(
        tokenGenStatesConsumerClient.PK,
        dynamoDBClient,
        genericLogger
      );

      const result = await readAllTokenGenStatesItems(dynamoDBClient);
      expect(result).toEqual([clientEntry]);
    });
  });

  it("readPlatformClientEntry", async () => {
    const clientEntry1 = getMockPlatformStatesClientEntry();

    const clientEntry2 = getMockPlatformStatesClientEntry();

    await writePlatformClientEntry(clientEntry1, dynamoDBClient, genericLogger);
    await writePlatformClientEntry(clientEntry2, dynamoDBClient, genericLogger);

    const res = await readPlatformClientEntry(clientEntry1.PK, dynamoDBClient);

    expect(res).toEqual(clientEntry1);
  });

  it("deleteEntriesFromTokenGenStatesByClientIdPurposeIdV1", async () => {
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

    await deleteEntriesFromTokenGenStatesByClientIdPurposeIdV1(
      GSIPK_clientId_purposeId,
      dynamoDBClient,
      genericLogger
    );

    const result = await readAllTokenGenStatesItems(dynamoDBClient);
    expect(result).toEqual([tokenGenStatesConsumerClient3]);
  });

  it("deleteEntriesFromTokenGenStatesByClientIdPurposeIdV2", async () => {
    const purposeId = generateId<PurposeId>();

    const key1 = getMockKey();
    const key2 = getMockKey();
    const client: Client = { ...getMockClient(), keys: [key1, key2] };
    const tokenClientKidPurposePK1 =
      makeTokenGenerationStatesClientKidPurposePK({
        clientId: client.id,
        kid: key1.kid,
        purposeId,
      });

    const tokenClientKidPurposePK2 =
      makeTokenGenerationStatesClientKidPurposePK({
        clientId: client.id,
        kid: key2.kid,
        purposeId,
      });

    const GSIPK_clientId_purposeId = makeGSIPKClientIdPurposeId({
      clientId: client.id,
      purposeId: generateId(),
    });
    const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient = {
      ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK1),
      GSIPK_clientId_purposeId,
    };

    const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient = {
      ...getMockTokenGenStatesConsumerClient(tokenClientKidPurposePK2),
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

    await deleteEntriesFromTokenGenStatesByClientIdPurposeIdV2(
      client,
      purposeId,
      dynamoDBClient,
      genericLogger
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
      GSIPK_clientId_kid: makeGSIPKClientIdKid({
        clientId,
        kid: kid1,
      }),
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
      GSIPK_clientId_kid: makeGSIPKClientIdKid({
        clientId,
        kid: kid2,
      }),
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
      dynamoDBClient,
      genericLogger
    );

    const expectedEntry1: TokenGenerationStatesConsumerClient = {
      consumerId: tokenGenStatesConsumerClient1.consumerId,
      updatedAt: new Date().toISOString(),
      PK: makeTokenGenerationStatesClientKidPK({ clientId, kid: kid1 }),
      clientKind: clientKindTokenGenStates.consumer,
      publicKey: tokenGenStatesConsumerClient1.publicKey,
      GSIPK_clientId: clientId,
      GSIPK_clientId_kid: makeGSIPKClientIdKid({
        clientId,
        kid: kid1,
      }),
    };

    const expectedEntry2: TokenGenerationStatesConsumerClient = {
      consumerId: tokenGenStatesConsumerClient2.consumerId,
      updatedAt: new Date().toISOString(),
      PK: makeTokenGenerationStatesClientKidPK({ clientId, kid: kid2 }),
      clientKind: "CONSUMER",
      publicKey: tokenGenStatesConsumerClient1.publicKey,
      GSIPK_clientId: clientId,
      GSIPK_clientId_kid: makeGSIPKClientIdKid({
        clientId,
        kid: kid2,
      }),
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
      await writeTokenGenStatesApiClient(
        clientEntry,
        dynamoDBClient,
        genericLogger
      );

      const result = await readAllTokenGenStatesItems(dynamoDBClient);
      expect(result).toEqual([clientEntry]);
    });

    it("should throw error if the entry already exists", async () => {
      const clientEntry = getMockTokenGenStatesApiClient();
      await writeTokenGenStatesApiClient(
        clientEntry,
        dynamoDBClient,
        genericLogger
      );

      expect(
        writeTokenGenStatesApiClient(clientEntry, dynamoDBClient, genericLogger)
      ).rejects.toThrowError();
    });
  });

  describe("upsertTokenGenStatesConsumerClient", () => {
    it("write", async () => {
      const tokenGenStatesConsumerClient =
        getMockTokenGenStatesConsumerClient();

      const resultBefore = await readAllTokenGenStatesItems(dynamoDBClient);
      expect(resultBefore).toEqual([]);

      await upsertTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient,
        dynamoDBClient,
        genericLogger
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
      await upsertTokenGenStatesConsumerClient(
        updatedEntry,
        dynamoDBClient,
        genericLogger
      );

      const resultAfter = await readAllTokenGenStatesItems(dynamoDBClient);
      expect(resultAfter).toEqual([updatedEntry]);
    });
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

    await writePlatformClientEntry(clientEntry1, dynamoDBClient, genericLogger);
    await writePlatformClientEntry(clientEntry2, dynamoDBClient, genericLogger);

    await setClientPurposeIdsInPlatformStatesEntry(
      {
        primaryKey: clientEntry1.PK,
        version: clientEntry1.version + 1,
        clientPurposeIds: [],
      },
      dynamoDBClient,
      genericLogger
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

    const agreementPK = makePlatformStatesAgreementPK({
      consumerId,
      eserviceId,
    });
    const agreementEntry: PlatformStatesAgreementEntry = {
      ...getMockPlatformStatesAgreementEntry(agreementPK, agreementId),
      agreementDescriptorId: descriptorId,
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
      agreementEntry,
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

      await upsertPlatformClientEntry(
        clientEntry,
        dynamoDBClient,
        genericLogger
      );

      const resultAfter = await readAllPlatformStatesItems(dynamoDBClient);
      expect(resultAfter).toEqual([clientEntry]);
    });
    it("update", async () => {
      const clientEntry: PlatformStatesClientEntry = {
        ...getMockPlatformStatesClientEntry(),
        clientKind: clientKindTokenGenStates.consumer,
      };

      await writePlatformClientEntry(
        clientEntry,
        dynamoDBClient,
        genericLogger
      );

      const updatedEntry: PlatformStatesClientEntry = {
        ...clientEntry,
        clientKind: clientKindTokenGenStates.api,
      };
      await upsertPlatformClientEntry(
        updatedEntry,
        dynamoDBClient,
        genericLogger
      );

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
        dynamoDBClient,
        genericLogger
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
        dynamoDBClient,
        genericLogger
      );

      const updatedEntry: TokenGenerationStatesApiClient = {
        ...tokenGenStatesApiClient,
        clientKind: clientKindTokenGenStates.api,
      };
      await upsertTokenGenStatesApiClient(
        updatedEntry,
        dynamoDBClient,
        genericLogger
      );

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
        consumerId: generateId<TenantId>(),
        clientKind: clientKindTokenGenStates.consumer,
        publicKey: "publicKey",
        GSIPK_clientId: generateId<ClientId>(),
        GSIPK_clientId_kid: makeGSIPKClientIdKid({
          clientId: generateId<ClientId>(),
          kid: "kid",
        }),
        updatedAt: new Date().toISOString(),
      };
    const entries3 = z
      .array(TokenGenerationStatesGenericClient)
      .safeParse([tokenGenStatesConsumerClientWithUndefined]);

    expect(entries3.data![0]).toEqual(
      tokenGenStatesConsumerClientWithUndefined
    );
  });

  it("updateTokenGenStatesDataForSecondRetrieval", async () => {
    const consumerId = generateId<TenantId>();
    const producerId = generateId<TenantId>();
    const descriptor = getMockDescriptor();
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      producerId,
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
      producerId,
      consumerId,
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
      producerId,
      GSIPK_clientId: client.id,
      GSIPK_clientId_kid: makeGSIPKClientIdKid({
        clientId: client.id,
        kid: key.kid,
      }),
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
      PK: makePlatformStatesAgreementPK({
        consumerId,
        eserviceId: eservice.id,
      }),
      version: 1,
      state: itemState.inactive,
      updatedAt: new Date().toISOString(),
      agreementId: agreement.id,
      agreementTimestamp: agreement.stamps.activation!.when.toISOString(),
      agreementDescriptorId: agreement.descriptorId,
      producerId: agreement.producerId,
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
      logger: genericLogger,
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
