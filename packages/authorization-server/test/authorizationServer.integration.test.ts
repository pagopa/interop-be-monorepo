import { fail } from "assert";
import * as uuidv4 from "uuid";
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
  getMockTokenStatesClientPurposeEntry,
  writeTokenStateEntry,
  getMockPurpose,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test";
import {
  ClientId,
  generateId,
  itemState,
  makeGSIPKKid,
  makeTokenGenerationStatesClientKidPurposePK,
  Purpose,
  purposeVersionState,
  TokenGenerationStatesClientPurposeEntry,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { config } from "../src/config/config.js";
import {
  configTokenGenerationStates,
  dynamoDBClient,
  fileManager,
  getMockAccessTokenRequest,
  getMockClientAssertion,
  mockKMSClient,
  mockProducer,
  tokenService,
} from "./utils.js";

describe("authorization server tests", () => {
  if (!configTokenGenerationStates) {
    fail();
  }
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

  it.only("success consumer", async () => {
    mockProducer.send.mockImplementationOnce(async () => Promise.resolve());
    mockKMSClient.send.mockImplementationOnce(async () => ({
      Signature: undefined,
    }));

    const uuid = generateId();
    vi.spyOn(uuidv4, "v4").mockReturnValue(uuid);
    vi.spyOn(fileManager, "storeBytes");

    const purpose: Purpose = {
      ...getMockPurpose(),
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };
    const clientId = generateId<ClientId>();
    const kid = `kid`;
    const { jws, publicKeyEncodedPem } = await getMockClientAssertion({
      standardClaimsOverride: { sub: clientId },
      customHeader: { kid },
      customClaims: { purposeId: purpose.id },
    });
    const tokenClientKidPurposePK = makeTokenGenerationStatesClientKidPurposePK(
      {
        clientId,
        kid,
        purposeId: purpose.id,
      }
    );
    console.log("tokenClientKidPurposePK", tokenClientKidPurposePK);
    const tokenClientPurposeEntry: TokenGenerationStatesClientPurposeEntry = {
      ...getMockTokenStatesClientPurposeEntry(tokenClientKidPurposePK),
      consumerId: purpose.consumerId,
      GSIPK_purposeId: purpose.id,
      purposeState: itemState.active,
      purposeVersionId: purpose.versions[0].id,
      agreementState: itemState.active,
      descriptorState: itemState.active,
      GSIPK_clientId: clientId,
      GSIPK_kid: makeGSIPKKid(kid),
      publicKey: publicKeyEncodedPem,
    };

    console.log(
      await writeTokenStateEntry(tokenClientPurposeEntry, dynamoDBClient)
    );

    const request = {
      ...(await getMockAccessTokenRequest()),
      client_assertion: jws,
      client_id: clientId,
    };
    const result = await tokenService.generateToken(request);
    expect(result.token).toBeDefined();
    const expectedResult = {
      limitReached: false,
      // TODO:
      token: result.token,
      rateLimiterStatus: {
        maxRequests: 2,
        rateInterval: 1000,
        remainingRequests: 1,
      },
    };
    expect(result).toEqual(expectedResult);

    expect(fileManager.storeBytes).toHaveBeenCalledWith(
      config.s3Bucket,
      // TODO: remove hard coded path
      "token-details",
      genericLogger
    );
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain("token-details/..${  }.ndjson");
  });

  // it("success api", async () => {
  //   vi.spyOn(fileManager, "storeBytes");

  //   // TODO: replace with logic from https://github.com/pagopa/interop-be-monorepo/pull/1098
  //   const keySet = crypto.generateKeyPairSync("rsa", {
  //     modulusLength: 2048,
  //   });
  //   const clientId = generateId<ClientId>();
  //   const kid = `kid ${Math.random()}`;
  //   const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
  //     clientId,
  //     kid,
  //   });
  //   const tokenClientEntry: TokenGenerationStatesClientEntry = {
  //     ...getMockTokenStatesClientEntry(tokenClientKidPK),
  //     GSIPK_clientId: clientId,
  //     GSIPK_kid: makeGSIPKKid(kid),
  //     publicKey: keySet.publicKey
  //       .export({ type: "pkcs1", format: "pem" })
  //       .toString("base64url"),
  //   };

  //   await writeTokenStateClientEntry(tokenClientEntry, dynamoDBClient);

  //   const clientAssertion = getMockClientAssertion({
  //     customHeader: { kid },
  //     standardClaimsOverride: {
  //       iss: clientId,
  //       sub: clientId,
  //     },
  //     customClaims: {},
  //     keySet,
  //   });
  //   const a = {
  //     ...getMockAccessTokenRequest(),
  //     client_assertion: clientAssertion,
  //     client_id: clientId,
  //   };
  //   const result = await tokenService.generateToken(a);
  //   expect(result.limitReached).toBeFalsy();
  //   expect(result.token).toBeDefined();
  //   // TODO: how to test result.rateLimiterStatus

  //   expect(fileManager.storeBytes).toHaveBeenCalledWith(
  //     config.s3Bucket,
  //     // TODO: remove hard coded path
  //     "token-details",
  //     genericLogger
  //   );
  //   expect(
  //     await fileManager.listFiles(config.s3Bucket, genericLogger)
  //   ).toContain("token-details");
  // });
});
