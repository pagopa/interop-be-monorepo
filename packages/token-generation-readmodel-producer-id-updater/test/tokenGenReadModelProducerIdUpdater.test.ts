import { genericLogger } from "pagopa-interop-commons";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockAgreement,
  getMockPlatformStatesAgreementEntry,
  getMockPlatformStatesClientEntry,
  getMockTokenGenStatesConsumerClient,
  readAllPlatformStatesItems,
  readAllTokenGenStatesItems,
  writePlatformAgreementEntry,
  writePlatformStatesClientEntry,
  writeTokenGenStatesConsumerClient,
} from "pagopa-interop-commons-test";
import {
  makePlatformStatesAgreementPK,
  TokenGenerationStatesConsumerClient,
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
import { addProducerIdToTokenGenReadModel } from "../src/utils/utils.js";
import { addOneAgreement, dynamoDBClient, readModelService } from "./utils.js";

describe("Token Generation Read Model producer id updater test", () => {
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

  it("should update token generation read model with producerId", async () => {
    const agreement1 = getMockAgreement();
    await addOneAgreement(agreement1);

    const agreement2 = getMockAgreement();
    await addOneAgreement(agreement2);

    // platform-states
    const platformStatesClient = getMockPlatformStatesClientEntry();
    await writePlatformStatesClientEntry(platformStatesClient, dynamoDBClient);

    const platformStatesAgreementPK1 = makePlatformStatesAgreementPK({
      consumerId: agreement1.consumerId,
      eserviceId: agreement1.eserviceId,
    });
    const platformStatesAgreement1 = getMockPlatformStatesAgreementEntry(
      platformStatesAgreementPK1,
      agreement1.id
    );
    await writePlatformAgreementEntry(platformStatesAgreement1, dynamoDBClient);

    const platformStatesAgreementPK2 = makePlatformStatesAgreementPK({
      consumerId: agreement2.consumerId,
      eserviceId: agreement2.eserviceId,
    });
    const platformStatesAgreement2 = getMockPlatformStatesAgreementEntry(
      platformStatesAgreementPK2,
      agreement2.id
    );
    await writePlatformAgreementEntry(platformStatesAgreement2, dynamoDBClient);

    // token-generation-states
    const tokenGenerationStatesConsumerClient1: TokenGenerationStatesConsumerClient =
      {
        ...getMockTokenGenStatesConsumerClient(),
        agreementId: agreement1.id,
      };
    await writeTokenGenStatesConsumerClient(
      tokenGenerationStatesConsumerClient1,
      dynamoDBClient
    );

    const tokenGenerationStatesConsumerClient2: TokenGenerationStatesConsumerClient =
      {
        ...getMockTokenGenStatesConsumerClient(),
        agreementId: agreement2.id,
      };
    await writeTokenGenStatesConsumerClient(
      tokenGenerationStatesConsumerClient2,
      dynamoDBClient
    );

    const tokenGenerationStatesConsumerClient3: TokenGenerationStatesConsumerClient =
      {
        ...getMockTokenGenStatesConsumerClient(),
        agreementId: undefined,
      };
    await writeTokenGenStatesConsumerClient(
      tokenGenerationStatesConsumerClient3,
      dynamoDBClient
    );

    const { platformStatesUpdateCount, tokenGenStatesUpdateCount } =
      await addProducerIdToTokenGenReadModel(
        dynamoDBClient,
        readModelService,
        genericLogger
      );

    expect(platformStatesUpdateCount).toEqual(2);
    expect(tokenGenStatesUpdateCount).toEqual(2);

    // platform-states
    const platformStatesEntries = await readAllPlatformStatesItems(
      dynamoDBClient
    );
    const expectedPlatformStatesAgreement1 = {
      ...platformStatesAgreement1,
      producerId: agreement1.producerId,
    };
    const expectedPlatformStatesAgreement2 = {
      ...platformStatesAgreement2,
      producerId: agreement2.producerId,
    };
    expect(platformStatesEntries).toEqual(
      expect.arrayContaining([
        platformStatesClient,
        expectedPlatformStatesAgreement1,
        expectedPlatformStatesAgreement2,
      ])
    );

    // token-generation-states
    const tokenGenerationStatesConsumerClients =
      await readAllTokenGenStatesItems(dynamoDBClient);
    const expectedTokenGenerationStatesConsumerClient1 = {
      ...tokenGenerationStatesConsumerClient1,
      producerId: agreement1.producerId,
    };
    const expectedTokenGenerationStatesConsumerClient2 = {
      ...tokenGenerationStatesConsumerClient2,
      producerId: agreement2.producerId,
    };
    expect(tokenGenerationStatesConsumerClients).toEqual(
      expect.arrayContaining([
        expectedTokenGenerationStatesConsumerClient1,
        expectedTokenGenerationStatesConsumerClient2,
        tokenGenerationStatesConsumerClient3,
      ])
    );
  });
});
