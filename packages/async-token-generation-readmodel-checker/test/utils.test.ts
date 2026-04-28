import { dateToSeconds, genericLogger } from "pagopa-interop-commons";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockAgreement,
  getMockClient,
  getMockDescriptor,
  getMockEService,
  getMockKey,
  getMockProducerKeychain,
  getMockPurpose,
  getMockPurposeVersion,
  writePlatformCatalogEntry,
  writeTokenGenStatesConsumerClient,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  agreementState,
  AsyncExchangeProperties,
  Client,
  clientKind,
  clientKindTokenGenStates,
  descriptorState,
  EService,
  generateId,
  Interaction,
  InteractionId,
  interactionState,
  itemState,
  makeGSIPKClientIdKid,
  makeGSIPKClientIdPurposeId,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makeInteractionPK,
  makePlatformStatesEServiceDescriptorPK,
  makeProducerKeychainPlatformStatesPK,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  ProducerKeychain,
  ProducerKeychainPlatformStateEntry,
  Purpose,
  purposeVersionState,
  TokenGenerationStatesConsumerClient,
  UserId,
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
import {
  compareAsyncPlatformStates,
  compareAsyncTokenGenerationStates,
  compareAsyncTokenGenerationReadModel,
  compareInteractions,
} from "../src/utils/utils.js";
import {
  addOneAgreement,
  addOneClient,
  addOneEService,
  addOneProducerKeychain,
  addOnePurpose,
  asyncTokenGenerationReadModelService,
  dynamoDBClient,
  readModelService,
  writeInteraction,
  writeProducerKeychainPlatformStateEntry,
} from "./utils.js";

const asyncExchangeProperties: AsyncExchangeProperties = {
  responseTime: 60,
  resourceAvailableTime: 120,
  confirmation: true,
  bulk: true,
  maxResultSet: 100,
};

const issuedAt = "2026-01-01T00:00:00.000Z";
const callbackIssuedAt = "2026-01-01T00:01:00.000Z";

type Fixture = {
  eservice: EService;
  descriptor: EService["descriptors"][number];
  purpose: Purpose;
  agreement: Agreement;
  client: Client;
  producerKeychain: ProducerKeychain;
  tokenGenerationEntry: TokenGenerationStatesConsumerClient;
  producerKeychainPlatformStateEntry: ProducerKeychainPlatformStateEntry;
  interaction: Interaction;
};

const buildFixture = (): Fixture => {
  const descriptor = {
    ...getMockDescriptor(descriptorState.published),
    state: descriptorState.published,
    audience: ["pagopa.it"],
    voucherLifespan: 600,
    asyncExchangeProperties,
  };
  const eservice = {
    ...getMockEService(),
    asyncExchange: true,
    descriptors: [descriptor],
  };
  const purposeVersion = getMockPurposeVersion(purposeVersionState.active);
  const purpose = {
    ...getMockPurpose([purposeVersion]),
    eserviceId: eservice.id,
  };
  const agreement = {
    ...getMockAgreement(),
    state: agreementState.active,
    consumerId: purpose.consumerId,
    eserviceId: eservice.id,
    descriptorId: descriptor.id,
    producerId: eservice.producerId,
    stamps: {
      activation: {
        when: new Date(issuedAt),
        who: generateId<UserId>(),
      },
    },
  };
  const clientKey = getMockKey();
  const client = getMockClient({
    kind: clientKind.consumer,
    consumerId: purpose.consumerId,
    purposes: [purpose.id],
    keys: [clientKey],
  });
  const producerKeychainKey = getMockKey();
  const producerKeychain = {
    ...getMockProducerKeychain({ producerId: eservice.producerId }),
    eservices: [eservice.id],
    keys: [producerKeychainKey],
  };

  const tokenGenerationEntry: TokenGenerationStatesConsumerClient = {
    PK: makeTokenGenerationStatesClientKidPurposePK({
      clientId: client.id,
      kid: clientKey.kid,
      purposeId: purpose.id,
    }),
    clientKind: clientKindTokenGenStates.consumer,
    publicKey: clientKey.encodedPem,
    updatedAt: issuedAt,
    GSIPK_clientId: client.id,
    GSIPK_clientId_kid: makeGSIPKClientIdKid({
      clientId: client.id,
      kid: clientKey.kid,
    }),
    producerId: eservice.producerId,
    consumerId: purpose.consumerId,
    agreementId: agreement.id,
    agreementState: itemState.active,
    GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
      consumerId: purpose.consumerId,
      eserviceId: eservice.id,
    }),
    GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
    }),
    descriptorState: itemState.active,
    descriptorAudience: descriptor.audience,
    descriptorVoucherLifespan: descriptor.voucherLifespan,
    asyncExchange: true,
    GSIPK_purposeId: purpose.id,
    purposeState: itemState.active,
    purposeVersionId: purposeVersion.id,
    GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
      clientId: client.id,
      purposeId: purpose.id,
    }),
  };

  const producerKeychainPlatformStateEntry: ProducerKeychainPlatformStateEntry =
    {
      PK: makeProducerKeychainPlatformStatesPK({
        producerKeychainId: producerKeychain.id,
        kid: producerKeychainKey.kid,
        eServiceId: eservice.id,
      }),
      publicKey: producerKeychainKey.encodedPem,
      producerKeychainId: producerKeychain.id,
      producerId: eservice.producerId,
      kid: producerKeychainKey.kid,
      eServiceId: eservice.id,
      version: 1,
      updatedAt: issuedAt,
    };

  const interactionId = generateId<InteractionId>();
  const interaction: Interaction = {
    PK: makeInteractionPK(interactionId),
    interactionId,
    clientId: client.id,
    purposeId: purpose.id,
    consumerId: purpose.consumerId,
    eServiceId: eservice.id,
    descriptorId: descriptor.id,
    state: interactionState.getResource,
    startInteractionTokenIssuedAt: issuedAt,
    callbackInvocationTokenIssuedAt: callbackIssuedAt,
    updatedAt: callbackIssuedAt,
    ttl:
      dateToSeconds(new Date(issuedAt)) +
      asyncExchangeProperties.responseTime +
      asyncExchangeProperties.resourceAvailableTime,
  };

  return {
    eservice,
    descriptor,
    purpose,
    agreement,
    client,
    producerKeychain,
    tokenGenerationEntry,
    producerKeychainPlatformStateEntry,
    interaction,
  };
};

const addReadModelFixture = async ({
  eservice,
  purpose,
  agreement,
  client,
  producerKeychain,
}: Fixture): Promise<void> => {
  await addOneEService(eservice);
  await addOnePurpose(purpose);
  await addOneAgreement(agreement);
  await addOneClient(client);
  await addOneProducerKeychain(producerKeychain);
};

const addDynamoFixture = async ({
  eservice,
  descriptor,
  tokenGenerationEntry,
  producerKeychainPlatformStateEntry,
  interaction,
}: Fixture): Promise<void> => {
  await writePlatformCatalogEntry(
    {
      PK: makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      }),
      state: itemState.active,
      descriptorAudience: descriptor.audience,
      descriptorVoucherLifespan: descriptor.voucherLifespan,
      asyncExchange: true,
      asyncExchangeProperties,
      version: 1,
      updatedAt: issuedAt,
    },
    dynamoDBClient
  );
  await writeTokenGenStatesConsumerClient(tokenGenerationEntry, dynamoDBClient);
  await writeProducerKeychainPlatformStateEntry(
    producerKeychainPlatformStateEntry
  );
  await writeInteraction(interaction);
};

describe("Async Token Generation Read Model Checker tests", () => {
  beforeEach(async () => {
    await buildDynamoDBTables(dynamoDBClient);
  });

  afterEach(async () => {
    await deleteDynamoDBTables(dynamoDBClient);
  });

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(issuedAt));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should not detect differences when SQL readmodel and async DynamoDB tables match", async () => {
    const fixture = buildFixture();
    await addReadModelFixture(fixture);
    await addDynamoFixture(fixture);

    const differences = await compareAsyncTokenGenerationReadModel({
      asyncTokenGenerationReadModelService,
      readModelService,
      logger: genericLogger,
      interactionTtlEpsilonSeconds: 0,
    });

    expect(differences).toBe(0);
  });

  it("should detect differences on async exchange properties in platform-states", () => {
    const fixture = buildFixture();

    expect(
      compareAsyncPlatformStates({
        eservices: [fixture.eservice],
        platformStates: [
          {
            PK: makePlatformStatesEServiceDescriptorPK({
              eserviceId: fixture.eservice.id,
              descriptorId: fixture.descriptor.id,
            }),
            state: itemState.active,
            descriptorAudience: fixture.descriptor.audience,
            descriptorVoucherLifespan: fixture.descriptor.voucherLifespan,
            asyncExchange: true,
            asyncExchangeProperties: {
              ...asyncExchangeProperties,
              resourceAvailableTime: 1,
            },
            version: 1,
            updatedAt: issuedAt,
          },
        ],
        logger: genericLogger,
      })
    ).toBe(1);
  });

  it("should detect a wrong asyncExchange flag in token-generation-states", async () => {
    const fixture = buildFixture();
    await addReadModelFixture(fixture);
    await addDynamoFixture({
      ...fixture,
      tokenGenerationEntry: {
        ...fixture.tokenGenerationEntry,
        asyncExchange: false,
      },
    });

    const differences = await compareAsyncTokenGenerationReadModel({
      asyncTokenGenerationReadModelService,
      readModelService,
      logger: genericLogger,
      interactionTtlEpsilonSeconds: 0,
    });

    expect(differences).toBe(1);
  });

  it("should detect an unexpected invalid async token-generation-states entry", () => {
    const fixture = buildFixture();
    const unexpectedKid = "unexpected-kid";
    const unexpectedAsyncEntry: TokenGenerationStatesConsumerClient = {
      PK: makeTokenGenerationStatesClientKidPK({
        clientId: fixture.client.id,
        kid: unexpectedKid,
      }),
      clientKind: clientKindTokenGenStates.consumer,
      publicKey: fixture.tokenGenerationEntry.publicKey,
      updatedAt: issuedAt,
      GSIPK_clientId: fixture.client.id,
      GSIPK_clientId_kid: makeGSIPKClientIdKid({
        clientId: fixture.client.id,
        kid: unexpectedKid,
      }),
      asyncExchange: true,
    };

    expect(
      compareAsyncTokenGenerationStates({
        readModelContext: {
          eservices: [fixture.eservice],
          purposes: [fixture.purpose],
          agreements: [fixture.agreement],
          clients: [fixture.client],
          producerKeychains: [],
        },
        tokenGenerationStates: [
          fixture.tokenGenerationEntry,
          unexpectedAsyncEntry,
        ],
        logger: genericLogger,
      })
    ).toBe(1);
  });

  it("should detect a missing producer-keychain-platform-states entry", async () => {
    const fixture = buildFixture();
    await addReadModelFixture(fixture);
    await addDynamoFixture(fixture);
    await deleteDynamoDBTables(dynamoDBClient);
    await buildDynamoDBTables(dynamoDBClient);
    await writePlatformCatalogEntry(
      {
        PK: makePlatformStatesEServiceDescriptorPK({
          eserviceId: fixture.eservice.id,
          descriptorId: fixture.descriptor.id,
        }),
        state: itemState.active,
        descriptorAudience: fixture.descriptor.audience,
        descriptorVoucherLifespan: fixture.descriptor.voucherLifespan,
        asyncExchange: true,
        asyncExchangeProperties,
        version: 1,
        updatedAt: issuedAt,
      },
      dynamoDBClient
    );
    await writeTokenGenStatesConsumerClient(
      fixture.tokenGenerationEntry,
      dynamoDBClient
    );
    await writeInteraction(fixture.interaction);

    const differences = await compareAsyncTokenGenerationReadModel({
      asyncTokenGenerationReadModelService,
      readModelService,
      logger: genericLogger,
      interactionTtlEpsilonSeconds: 0,
    });

    expect(differences).toBe(1);
  });

  it("should count unparsable interaction entries", () => {
    expect(
      compareInteractions({
        rawInteractions: [{ PK: "not-an-interaction" }],
        readModelContext: {
          eservices: [],
          purposes: [],
          agreements: [],
          clients: [],
          producerKeychains: [],
        },
        platformStates: [],
        interactionTtlEpsilonSeconds: 0,
        logger: genericLogger,
      })
    ).toBe(1);
  });

  it("should detect interactions referencing missing readmodel entries", () => {
    const fixture = buildFixture();

    expect(
      compareInteractions({
        rawInteractions: [fixture.interaction],
        readModelContext: {
          eservices: [],
          purposes: [],
          agreements: [],
          clients: [],
          producerKeychains: [],
        },
        platformStates: [],
        interactionTtlEpsilonSeconds: 0,
        logger: genericLogger,
      })
    ).toBe(4);
  });

  it("should detect missing timestamps and ttl mismatch on interactions", () => {
    const fixture = buildFixture();
    const brokenInteraction: Interaction = {
      ...fixture.interaction,
      callbackInvocationTokenIssuedAt: undefined,
      ttl: fixture.interaction.ttl + 1,
    };

    expect(
      compareInteractions({
        rawInteractions: [brokenInteraction],
        readModelContext: {
          eservices: [fixture.eservice],
          purposes: [fixture.purpose],
          agreements: [fixture.agreement],
          clients: [fixture.client],
          producerKeychains: [],
        },
        platformStates: [
          {
            PK: makePlatformStatesEServiceDescriptorPK({
              eserviceId: fixture.eservice.id,
              descriptorId: fixture.descriptor.id,
            }),
            state: itemState.active,
            descriptorAudience: fixture.descriptor.audience,
            descriptorVoucherLifespan: fixture.descriptor.voucherLifespan,
            asyncExchange: true,
            asyncExchangeProperties,
            version: 1,
            updatedAt: issuedAt,
          },
        ],
        interactionTtlEpsilonSeconds: 0,
        logger: genericLogger,
      })
    ).toBe(2);
  });
});
