/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { fail } from "assert";
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
  GeneratedTokenAuditDetails,
  generateId,
  itemState,
  makeGSIPKKid,
  makeTokenGenerationStatesClientKidPurposePK,
  Purpose,
  purposeVersionState,
  TokenGenerationStatesClientPurposeEntry,
  unsafeBrandId,
} from "pagopa-interop-models";
import { formatDateyyyyMMdd, genericLogger } from "pagopa-interop-commons";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import { config } from "../src/config/config.js";
import {
  clientAssertionRequestValidationFailed,
  clientAssertionValidationFailed,
} from "../src/model/domain/errors.js";
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

  // TODO: tests
  // - rate limiter
  // tokenGenerationStatesEntryNotFound
  // - key type mismatch
  // clientAssertionSignatureValidationFailed
  // platformStateValidationFailed
  // tokenSigningFailed
  // kafkaAuditingFailed
  // fallbackAuditFailed
  // unexpectedTokenGenerationError

  it.skip("should generate a token and publish audit with fallback", async () => {
    mockProducer.send.mockImplementationOnce(async () => Promise.reject());
    mockKMSClient.send.mockImplementationOnce(async () => ({
      Signature: "mock signature",
    }));

    vi.spyOn(fileManager, "storeBytes");

    const purpose: Purpose = {
      ...getMockPurpose(),
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };
    const clientId = generateId<ClientId>();
    const kid = `kid`;

    const { jws, clientAssertion, publicKeyEncodedPem } =
      await getMockClientAssertion({
        standardClaimsOverride: {
          sub: clientId,
          exp: Date.now() / 1000 + 3600,
        },
        customHeader: { kid },
        customClaims: { purposeId: purpose.id },
      });
    console.log("jws", jws);
    console.log("clientId", clientId);
    const tokenClientKidPurposePK = makeTokenGenerationStatesClientKidPurposePK(
      {
        clientId,
        kid,
        purposeId: purpose.id,
      }
    );
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

    await writeTokenStateEntry(tokenClientPurposeEntry, dynamoDBClient);

    const request = {
      ...(await getMockAccessTokenRequest()),
      client_assertion: jws,
      client_id: clientId,
    };
    vi.useRealTimers();
    const result = await tokenService.generateToken(
      request,
      generateId(),
      genericLogger
    );
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

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

    const date = new Date();
    const ymdDate = formatDateyyyyMMdd(date);

    const fileList = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );
    expect(fileList).toHaveLength(1);
    const file = fileList[0];
    const split = file.split("_");
    expect(split[0]).toEqual(`token-details/${ymdDate}/${ymdDate}`);
    expect(split[2]).toEqual(`${generateId()}.ndjson`);

    const messageBody: GeneratedTokenAuditDetails = {
      jwtId: result.token!.payload.jti,
      correlationId: generateId(),
      issuedAt: result.token!.payload.iat,
      clientId,
      organizationId: purpose.consumerId,
      agreementId: unsafeBrandId(tokenClientPurposeEntry.agreementId!),
      eserviceId: unsafeBrandId(
        tokenClientPurposeEntry.GSIPK_eserviceId_descriptorId!.split("#")[0]
      ),
      descriptorId: unsafeBrandId(
        tokenClientPurposeEntry.GSIPK_eserviceId_descriptorId!.split("#")[1]
      ),
      purposeId: purpose.id,
      purposeVersionId: purpose.versions[0].id,
      algorithm: result.token!.header.alg,
      keyId: result.token!.header.kid,
      audience: result.token!.payload.aud.join(","),
      subject: result.token!.payload.sub,
      notBefore: result.token!.payload.nbf,
      expirationTime: result.token!.payload.exp,
      issuer: result.token!.payload.iss,
      clientAssertion: {
        algorithm: clientAssertion.header.alg,
        // TODO: improve typeof
        audience: !clientAssertion.payload.aud
          ? ""
          : typeof clientAssertion.payload.aud === "string"
          ? clientAssertion.payload.aud
          : clientAssertion.payload.aud.join(","),
        // TODO: double check if the toMillis function is needed
        expirationTime: clientAssertion.payload.exp!,
        issuedAt: clientAssertion.payload.iat!,
        issuer: clientAssertion.payload.iss!,
        jwtId: clientAssertion.payload.jti!,
        keyId: clientAssertion.header.kid!,
        subject: unsafeBrandId(clientAssertion.payload.sub!),
      },
    };

    const expectedFileContent = JSON.stringify(messageBody) + "\n";

    const fileContent = await fileManager.get(
      config.s3Bucket,
      file,
      genericLogger
    );

    const decodedFileContent = new TextDecoder().decode(fileContent);
    expect(decodedFileContent).toEqual(expectedFileContent);
  });

  // TODO: kafka should return list of RecordMetadata with partition, topic name, errorCode
  it("should generate a token and publish audit with kafka", async () => {
    mockProducer.send.mockImplementationOnce(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);
    mockKMSClient.send.mockImplementationOnce(async () => ({
      Signature: "mock signature",
    }));

    vi.spyOn(mockProducer, "send");

    const purpose: Purpose = {
      ...getMockPurpose(),
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };
    const clientId = generateId<ClientId>();
    const kid = `kid`;

    const { jws, clientAssertion, publicKeyEncodedPem } =
      await getMockClientAssertion({
        standardClaimsOverride: {
          sub: clientId,
          exp: Date.now() / 1000 + 3600,
        },
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

    await writeTokenStateEntry(tokenClientPurposeEntry, dynamoDBClient);

    const request = {
      ...(await getMockAccessTokenRequest()),
      client_assertion: jws,
      client_id: clientId,
    };
    vi.useRealTimers();
    const result = await tokenService.generateToken(
      request,
      generateId(),
      genericLogger
    );
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

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

    // const date = new Date();
    // const ymdDate = formatDateyyyyMMdd(date);

    const fileList = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );
    expect(fileList).toHaveLength(0);
    // const file = fileList[0];
    // const split = file.split("_");
    // expect(split[0]).toEqual(`token-details/${ymdDate}/${ymdDate}`);
    // expect(split[2]).toEqual(`${generateId()}.ndjson`);

    const messageBody: GeneratedTokenAuditDetails = {
      jwtId: result.token!.payload.jti,
      correlationId: generateId(),
      issuedAt: result.token!.payload.iat,
      clientId,
      organizationId: purpose.consumerId,
      agreementId: unsafeBrandId(tokenClientPurposeEntry.agreementId!),
      eserviceId: unsafeBrandId(
        tokenClientPurposeEntry.GSIPK_eserviceId_descriptorId!.split("#")[0]
      ),
      descriptorId: unsafeBrandId(
        tokenClientPurposeEntry.GSIPK_eserviceId_descriptorId!.split("#")[1]
      ),
      purposeId: purpose.id,
      purposeVersionId: purpose.versions[0].id,
      algorithm: result.token!.header.alg,
      keyId: result.token!.header.kid,
      audience: result.token!.payload.aud.join(","),
      subject: result.token!.payload.sub,
      notBefore: result.token!.payload.nbf,
      expirationTime: result.token!.payload.exp,
      issuer: result.token!.payload.iss,
      clientAssertion: {
        algorithm: clientAssertion.header.alg,
        // TODO: improve typeof
        audience: !clientAssertion.payload.aud
          ? ""
          : typeof clientAssertion.payload.aud === "string"
          ? clientAssertion.payload.aud
          : clientAssertion.payload.aud.join(","),
        expirationTime: clientAssertion.payload.exp!,
        issuedAt: clientAssertion.payload.iat!,
        issuer: clientAssertion.payload.iss!,
        jwtId: clientAssertion.payload.jti!,
        keyId: clientAssertion.header.kid!,
        subject: unsafeBrandId(clientAssertion.payload.sub!),
      },
    };

    expect(mockProducer.send).toHaveBeenCalledWith({
      messages: [
        {
          key: messageBody.jwtId,
          value: JSON.stringify(messageBody) + "\n",
        },
      ],
    });

    // const expectedFileContent = JSON.stringify(messageBody) + "\n";

    // const fileContent = await fileManager.get(
    //   config.s3Bucket,
    //   file,
    //   genericLogger
    // );

    // const decodedFileContent = new TextDecoder().decode(fileContent);
    // expect(decodedFileContent).toEqual(expectedFileContent);
  });

  it("clientAssertionRequestValidationFailed", async () => {
    const { jws } = await getMockClientAssertion();

    const clientId = generateId<ClientId>();
    const request: authorizationServerApi.AccessTokenRequest = {
      ...(await getMockAccessTokenRequest()),
      client_assertion_type: "wrong-client-assertion-type",
      client_assertion: jws,
      client_id: clientId,
    };
    expect(
      tokenService.generateToken(request, generateId(), genericLogger)
    ).rejects.toThrowError(clientAssertionRequestValidationFailed(request));
  });

  it("clientAssertionValidationFailed", async () => {
    const { jws } = await getMockClientAssertion({
      standardClaimsOverride: { iat: undefined },
    });

    const clientId = generateId<ClientId>();
    const request: authorizationServerApi.AccessTokenRequest = {
      ...(await getMockAccessTokenRequest()),
      client_assertion: jws,
      client_id: clientId,
    };
    expect(
      tokenService.generateToken(request, generateId(), genericLogger)
    ).rejects.toThrowError(clientAssertionValidationFailed(jws, clientId));
  });
});
