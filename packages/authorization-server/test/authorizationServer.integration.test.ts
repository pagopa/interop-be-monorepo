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
  getMockTokenStatesClientEntry,
} from "pagopa-interop-commons-test";
import {
  ClientId,
  clientKidPrefix,
  clientKidPurposePrefix,
  clientKindTokenStates,
  GeneratedTokenAuditDetails,
  generateId,
  itemState,
  makeGSIPKKid,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  Purpose,
  PurposeId,
  purposeVersionState,
  TokenGenerationStatesClientEntry,
  TokenGenerationStatesClientPurposeEntry,
  unsafeBrandId,
} from "pagopa-interop-models";
import { formatDateyyyyMMdd, genericLogger } from "pagopa-interop-commons";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import * as uuidv4 from "uuid";
import { config } from "../src/config/config.js";
import {
  clientAssertionRequestValidationFailed,
  clientAssertionSignatureValidationFailed,
  clientAssertionValidationFailed,
  fallbackAuditFailed,
  invalidTokenClientKidPurposeEntry,
  keyTypeMismatch,
  platformStateValidationFailed,
  tokenGenerationStatesEntryNotFound,
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
  writeTokenStateClientEntry,
} from "./utils.js";

describe("authorization server tests", () => {
  if (!configTokenGenerationStates) {
    fail();
  }
  beforeEach(async () => {
    await buildDynamoDBTables(dynamoDBClient);
    mockKMSClient.send.mockImplementation(async () => ({
      Signature: "mock signature",
    }));
  });
  afterEach(async () => {
    await deleteDynamoDBTables(dynamoDBClient);
    vi.restoreAllMocks();
  });
  // const mockDate = new Date();

  // beforeAll(() => {
  //   vi.useFakeTimers();
  //   vi.setSystemTime(mockDate);
  // });
  // afterAll(() => {
  //   vi.useRealTimers();
  // });

  // TODO: tests
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
  it.skip("should generate a token and publish audit with kafka", async () => {
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

  it("tokenGenerationStatesEntryNotFound", async () => {
    const purposeId = generateId<PurposeId>();
    const clientId = generateId<ClientId>();
    const { jws, clientAssertion } = await getMockClientAssertion({
      standardClaimsOverride: { sub: clientId },
      customClaims: { purposeId },
    });

    const request: authorizationServerApi.AccessTokenRequest = {
      ...(await getMockAccessTokenRequest()),
      client_assertion: jws,
      client_id: clientId,
    };

    const entryPK = makeTokenGenerationStatesClientKidPurposePK({
      clientId,
      kid: clientAssertion.header.kid!,
      purposeId,
    });
    expect(
      tokenService.generateToken(request, generateId(), genericLogger)
    ).rejects.toThrowError(tokenGenerationStatesEntryNotFound(entryPK));
  });

  it("invalidTokenClientKidPurposeEntry", async () => {
    const purposeId = generateId<PurposeId>();
    const clientId = generateId<ClientId>();

    const { jws, clientAssertion } = await getMockClientAssertion({
      standardClaimsOverride: { sub: clientId },
      customClaims: { purposeId },
    });

    const request: authorizationServerApi.AccessTokenRequest = {
      ...(await getMockAccessTokenRequest()),
      client_assertion: jws,
      client_id: clientId,
    };

    const tokenClientKidPurposePK = makeTokenGenerationStatesClientKidPurposePK(
      {
        clientId,
        kid: clientAssertion.header.kid!,
        purposeId,
      }
    );

    const tokenClientPurposeEntry: TokenGenerationStatesClientPurposeEntry = {
      ...getMockTokenStatesClientPurposeEntry(tokenClientKidPurposePK),
      agreementId: undefined,
    };

    await writeTokenStateEntry(tokenClientPurposeEntry, dynamoDBClient);
    expect(
      tokenService.generateToken(request, generateId(), genericLogger)
    ).rejects.toThrowError(invalidTokenClientKidPurposeEntry());
  });

  it("keyTypeMismatch - clientKid entry with consumer kind", async () => {
    const clientId = generateId<ClientId>();
    const { jws, clientAssertion } = await getMockClientAssertion({
      standardClaimsOverride: { sub: clientId },
    });

    const request: authorizationServerApi.AccessTokenRequest = {
      ...(await getMockAccessTokenRequest()),
      client_assertion: jws,
      client_id: clientId,
    };

    const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
      clientId,
      kid: clientAssertion.header.kid!,
    });

    const tokenClientKidEntry: TokenGenerationStatesClientEntry = {
      ...getMockTokenStatesClientEntry(tokenClientKidPK),
      clientKind: clientKindTokenStates.consumer,
    };

    await writeTokenStateClientEntry(tokenClientKidEntry, dynamoDBClient);

    expect(
      tokenService.generateToken(request, generateId(), genericLogger)
    ).rejects.toThrowError(
      keyTypeMismatch(clientKidPrefix, clientKindTokenStates.consumer)
    );
  });

  it("keyTypeMismatch - clientKidPurpose entry with api kind", async () => {
    const purposeId = generateId<PurposeId>();
    const clientId = generateId<ClientId>();

    const { jws, clientAssertion } = await getMockClientAssertion({
      standardClaimsOverride: { sub: clientId },
      customClaims: { purposeId },
    });

    const request: authorizationServerApi.AccessTokenRequest = {
      ...(await getMockAccessTokenRequest()),
      client_assertion: jws,
      client_id: clientId,
    };

    const tokenClientKidPurposePK = makeTokenGenerationStatesClientKidPurposePK(
      {
        clientId,
        kid: clientAssertion.header.kid!,
        purposeId,
      }
    );

    const tokenClientKidPurposeEntry: TokenGenerationStatesClientPurposeEntry =
      {
        ...getMockTokenStatesClientPurposeEntry(tokenClientKidPurposePK),
        clientKind: clientKindTokenStates.api,
      };

    await writeTokenStateEntry(tokenClientKidPurposeEntry, dynamoDBClient);

    expect(
      tokenService.generateToken(request, generateId(), genericLogger)
    ).rejects.toThrowError(
      keyTypeMismatch(clientKidPurposePrefix, clientKindTokenStates.api)
    );
  });

  it("clientAssertionSignatureValidationFailed", async () => {
    const purposeId = generateId<PurposeId>();
    const clientId = generateId<ClientId>();

    const { jws, clientAssertion } = await getMockClientAssertion({
      standardClaimsOverride: { sub: clientId },
      customClaims: { purposeId },
    });

    const splitJws = jws.split(".");
    const jwsWithWrongSignature = `${splitJws[0]}.${splitJws[1]}.wrong-singature`;

    const request: authorizationServerApi.AccessTokenRequest = {
      ...(await getMockAccessTokenRequest()),
      client_assertion: jwsWithWrongSignature,
      client_id: clientId,
    };

    const tokenClientKidPurposePK = makeTokenGenerationStatesClientKidPurposePK(
      {
        clientId,
        kid: clientAssertion.header.kid!,
        purposeId,
      }
    );

    const tokenClientKidPurposeEntry: TokenGenerationStatesClientPurposeEntry =
      getMockTokenStatesClientPurposeEntry(tokenClientKidPurposePK);

    await writeTokenStateEntry(tokenClientKidPurposeEntry, dynamoDBClient);

    expect(
      tokenService.generateToken(request, generateId(), genericLogger)
    ).rejects.toThrowError(
      clientAssertionSignatureValidationFailed(request.client_assertion)
    );
  });

  it("platformStateValidationFailed", async () => {
    const purposeId = generateId<PurposeId>();
    const clientId = generateId<ClientId>();

    const { jws, clientAssertion, publicKeyEncodedPem } =
      await getMockClientAssertion({
        standardClaimsOverride: { sub: clientId },
        customClaims: { purposeId },
      });

    const request: authorizationServerApi.AccessTokenRequest = {
      ...(await getMockAccessTokenRequest()),
      client_assertion: jws,
      client_id: clientId,
    };

    const tokenClientKidPurposePK = makeTokenGenerationStatesClientKidPurposePK(
      {
        clientId,
        kid: clientAssertion.header.kid!,
        purposeId,
      }
    );

    const tokenClientKidPurposeEntry: TokenGenerationStatesClientPurposeEntry =
      {
        ...getMockTokenStatesClientPurposeEntry(tokenClientKidPurposePK),
        descriptorState: itemState.inactive,
        publicKey: publicKeyEncodedPem,
      };

    await writeTokenStateEntry(tokenClientKidPurposeEntry, dynamoDBClient);

    expect(
      tokenService.generateToken(request, generateId(), genericLogger)
    ).rejects.toThrowError(platformStateValidationFailed());
  });

  it("rate limit exceeded", async () => {
    const purposeId = generateId<PurposeId>();
    const clientId = generateId<ClientId>();

    const { jws, clientAssertion, publicKeyEncodedPem } =
      await getMockClientAssertion({
        standardClaimsOverride: { sub: clientId },
        customClaims: { purposeId },
      });

    const request: authorizationServerApi.AccessTokenRequest = {
      ...(await getMockAccessTokenRequest()),
      client_assertion: jws,
      client_id: clientId,
    };

    const tokenClientKidPurposePK = makeTokenGenerationStatesClientKidPurposePK(
      {
        clientId,
        kid: clientAssertion.header.kid!,
        purposeId,
      }
    );

    const tokenClientKidPurposeEntry: TokenGenerationStatesClientPurposeEntry =
      {
        ...getMockTokenStatesClientPurposeEntry(tokenClientKidPurposePK),
        publicKey: publicKeyEncodedPem,
      };

    await writeTokenStateEntry(tokenClientKidPurposeEntry, dynamoDBClient);
    // eslint-disable-next-line functional/no-let
    for (let i = 0; i < config.rateLimiterMaxRequests; i++) {
      const response = await tokenService.generateToken(
        request,
        generateId(),
        genericLogger
      );
      expect(response.limitReached).toBe(false);
      expect(response.rateLimiterStatus.remainingRequests).toBe(
        config.rateLimiterMaxRequests - i - 1
      );
    }

    const responseAfterLimitExceeded = await tokenService.generateToken(
      request,
      generateId(),
      genericLogger
    );

    expect(responseAfterLimitExceeded).toEqual({
      limitReached: true,
      rateLimitedTenantId: tokenClientKidPurposeEntry.consumerId,
      token: undefined,
      rateLimiterStatus: {
        maxRequests: config.rateLimiterMaxRequests,
        rateInterval: config.rateLimiterRateInterval,
        remainingRequests: 0,
      },
    });
  });
});
