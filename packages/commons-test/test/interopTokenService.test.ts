import {
  AuthorizationServerTokenGenerationConfig,
  InteropTokenGenerator,
  SessionTokenGenerationConfig,
  TokenGenerationConfig,
  UserClaims,
  UserRole,
  b64ByteUrlDecode,
  calculateKid,
  dateToSeconds,
  systemRole,
  userRole,
} from "pagopa-interop-commons";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  algorithm,
  ClientAssertionDigest,
  ClientId,
  DescriptorId,
  EServiceId,
  generateId,
  PurposeId,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import { KMSClient } from "@aws-sdk/client-kms";
import { getMockDPoPProof, getMockSessionClaims } from "../src/testUtils.js";

const deserializeJWT = (jwt: string): JSON =>
  b64ByteUrlDecode(jwt.split(".")[1]);

describe("Token Generator", () => {
  const mockDate = new Date();
  const mockTimeStamp = dateToSeconds(new Date());

  const authServerConfig: AuthorizationServerTokenGenerationConfig = {
    generatedInteropTokenKid: generateId(),
    generatedInteropTokenIssuer: "Interop Issuer",
    generatedInteropTokenM2MAudience: ["M2M Audience1", "M2M Audience2"],
    generatedInteropTokenM2MDurationSeconds: 1000,
  };

  const interopTokenGenerationConfig: TokenGenerationConfig = {
    kid: generateId(),
    subject: "JWT subject",
    issuer: "Generic Issuer",
    audience: ["Generic Audience1", "Generic Audience2"],
    secondsDuration: 1000,
  };

  const sessionTokenGenerationConfig: SessionTokenGenerationConfig = {
    generatedKid: generateId(),
    generatedIssuer: "PagoPA",
    generatedAudience: ["all"],
    generatedSecondsDuration: 1000,
  };

  const verifyCustomClaims = (
    payload: JSON,
    expectedClaims: UserClaims
  ): void => {
    expect(payload).toMatchObject({
      "user-roles": expectedClaims["user-roles"].join(","),
      organizationId: expectedClaims.organizationId,
      selfcareId: expectedClaims.selfcareId,
      externalId: {
        origin: expectedClaims.externalId.origin,
        value: expectedClaims.externalId.value,
      },
    });
  };

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const kmsClient = {
    send: vi.fn().mockReturnValue({
      Signature: new Uint8Array(
        Buffer.from("A valid signature for all tokens")
      ),
    }),
  } as unknown as KMSClient;

  describe("Session JWT Token", () => {
    it("should have Session claims for multiple user roles: api,security", async () => {
      const claims = getMockSessionClaims([
        userRole.API_ROLE,
        userRole.SECURITY_ROLE,
      ]);

      const interopTokenGenerator = new InteropTokenGenerator(
        sessionTokenGenerationConfig,
        kmsClient
      );

      const actualToken = await interopTokenGenerator.generateSessionToken(
        claims,
        1000
      );
      expect(actualToken.header).toEqual({
        alg: algorithm.RS256,
        use: "sig",
        typ: "at+jwt",
        kid: sessionTokenGenerationConfig.generatedKid,
      });

      const decodedActualToken = deserializeJWT(actualToken.serialized);

      expect(decodedActualToken).toMatchObject({
        jti: expect.any(String),
        iss: sessionTokenGenerationConfig.generatedIssuer,
        aud: sessionTokenGenerationConfig.generatedAudience.join(","),
        iat: mockTimeStamp,
        nbf: mockTimeStamp,
        exp:
          mockTimeStamp + sessionTokenGenerationConfig.generatedSecondsDuration,
      });

      verifyCustomClaims(decodedActualToken, claims);

      expect(decodedActualToken).toMatchObject({
        uid: claims.uid,
        name: claims.name,
        family_name: claims.family_name,
        email: claims.email,
      });
    });

    it.each(Object.values(userRole))(
      "should have Session claims for role %s",
      async (role: UserRole) => {
        const claims = getMockSessionClaims([role]);

        const interopTokenGenerator = new InteropTokenGenerator(
          sessionTokenGenerationConfig,
          kmsClient
        );

        const actualToken = await interopTokenGenerator.generateSessionToken(
          claims,
          1000
        );
        expect(actualToken.header).toEqual({
          alg: algorithm.RS256,
          use: "sig",
          typ: "at+jwt",
          kid: sessionTokenGenerationConfig.generatedKid,
        });

        const decodedActualToken = deserializeJWT(actualToken.serialized);

        expect(decodedActualToken).toMatchObject({
          jti: expect.any(String),
          iss: sessionTokenGenerationConfig.generatedIssuer,
          aud: sessionTokenGenerationConfig.generatedAudience.join(","),
          iat: mockTimeStamp,
          nbf: mockTimeStamp,
          exp:
            mockTimeStamp +
            sessionTokenGenerationConfig.generatedSecondsDuration,
        });

        verifyCustomClaims(decodedActualToken, claims);

        expect(decodedActualToken).toMatchObject({
          uid: claims.uid,
          name: claims.name,
          family_name: claims.family_name,
          email: claims.email,
          organization: {
            id: claims.organization.id,
            name: claims.organization.name,
            roles: claims.organization.roles,
          },
        });
      }
    );
  });

  describe("Api JWT Token", () => {
    it("should have M2M token claims", async () => {
      const subClientId: ClientId = generateId();
      const consumerId: TenantId = generateId();

      const interopTokenGenerator = new InteropTokenGenerator(
        authServerConfig,
        kmsClient
      );

      const actualToken = await interopTokenGenerator.generateInteropApiToken({
        sub: subClientId,
        consumerId,
        clientAdminId: undefined,
      });

      expect(actualToken.header).toEqual({
        alg: algorithm.RS256,
        use: "sig",
        typ: "at+jwt",
        kid: authServerConfig.generatedInteropTokenKid,
      });

      const decodedActualToken = deserializeJWT(actualToken.serialized);

      expect(decodedActualToken).toMatchObject({
        jti: expect.any(String),
        iss: authServerConfig.generatedInteropTokenIssuer,
        aud: authServerConfig.generatedInteropTokenM2MAudience.join(","),
        client_id: subClientId,
        sub: subClientId,
        iat: mockTimeStamp,
        nbf: mockTimeStamp,
        exp:
          mockTimeStamp +
          authServerConfig.generatedInteropTokenM2MDurationSeconds,
        organizationId: consumerId,
      });
    });

    it("should have M2M-Admin token claims", async () => {
      const subClientId: ClientId = generateId();
      const consumerId: TenantId = generateId();
      const adminClientId: UserId = generateId();

      const interopTokenGenerator = new InteropTokenGenerator(
        authServerConfig,
        kmsClient
      );

      const actualToken = await interopTokenGenerator.generateInteropApiToken({
        sub: subClientId,
        consumerId,
        clientAdminId: adminClientId,
      });

      expect(actualToken.header).toEqual({
        alg: algorithm.RS256,
        use: "sig",
        typ: "at+jwt",
        kid: authServerConfig.generatedInteropTokenKid,
      });

      const decodedActualToken = deserializeJWT(actualToken.serialized);

      expect(decodedActualToken).toEqual({
        jti: expect.any(String),
        iss: authServerConfig.generatedInteropTokenIssuer,
        aud: authServerConfig.generatedInteropTokenM2MAudience.join(","),
        client_id: subClientId,
        sub: subClientId,
        iat: mockTimeStamp,
        nbf: mockTimeStamp,
        exp:
          mockTimeStamp +
          authServerConfig.generatedInteropTokenM2MDurationSeconds,
        organizationId: consumerId,
        adminId: adminClientId,
        role: systemRole.M2M_ADMIN_ROLE,
      });
    });
  });

  describe("Api JWT DPoP Token", () => {
    it("should have M2M DPoP token claims", async () => {
      const subClientId: ClientId = generateId();
      const consumerId: TenantId = generateId();
      const { dpopProofJWT } = await getMockDPoPProof();

      const interopTokenGenerator = new InteropTokenGenerator(
        authServerConfig,
        kmsClient
      );

      const actualToken = await interopTokenGenerator.generateInteropApiToken({
        sub: subClientId,
        consumerId,
        clientAdminId: undefined,
        dpopJWK: dpopProofJWT.header.jwk,
      });

      expect(actualToken.header).toEqual({
        alg: algorithm.RS256,
        use: "sig",
        typ: "at+jwt",
        kid: authServerConfig.generatedInteropTokenKid,
      });

      const decodedActualToken = deserializeJWT(actualToken.serialized);

      expect(decodedActualToken).toMatchObject({
        jti: expect.any(String),
        iss: authServerConfig.generatedInteropTokenIssuer,
        aud: authServerConfig.generatedInteropTokenM2MAudience.join(","),
        client_id: subClientId,
        sub: subClientId,
        iat: mockTimeStamp,
        nbf: mockTimeStamp,
        exp:
          mockTimeStamp +
          authServerConfig.generatedInteropTokenM2MDurationSeconds,
        organizationId: consumerId,
        cnf: {
          jkt: calculateKid(dpopProofJWT?.header.jwk),
        },
      });
    });

    it("should have M2M-Admin DPoP token claims", async () => {
      const subClientId: ClientId = generateId();
      const consumerId: TenantId = generateId();
      const adminClientId: UserId = generateId();
      const { dpopProofJWT } = await getMockDPoPProof();

      const interopTokenGenerator = new InteropTokenGenerator(
        authServerConfig,
        kmsClient
      );

      const actualToken = await interopTokenGenerator.generateInteropApiToken({
        sub: subClientId,
        consumerId,
        clientAdminId: adminClientId,
        dpopJWK: dpopProofJWT.header.jwk,
      });

      expect(actualToken.header).toEqual({
        alg: algorithm.RS256,
        use: "sig",
        typ: "at+jwt",
        kid: authServerConfig.generatedInteropTokenKid,
      });

      const decodedActualToken = deserializeJWT(actualToken.serialized);

      expect(decodedActualToken).toEqual({
        jti: expect.any(String),
        iss: authServerConfig.generatedInteropTokenIssuer,
        aud: authServerConfig.generatedInteropTokenM2MAudience.join(","),
        client_id: subClientId,
        sub: subClientId,
        iat: mockTimeStamp,
        nbf: mockTimeStamp,
        exp:
          mockTimeStamp +
          authServerConfig.generatedInteropTokenM2MDurationSeconds,
        organizationId: consumerId,
        adminId: adminClientId,
        role: systemRole.M2M_ADMIN_ROLE,
        cnf: {
          jkt: calculateKid(dpopProofJWT?.header.jwk),
        },
      });
    });
  });

  describe("Consumer JWT Token", () => {
    it("should have Interop Consumer token claims", async () => {
      const subClientId: ClientId = generateId();
      const audience = ["Audience1", "Audience2"];
      const purposeId = generateId<PurposeId>();
      const consumerId: TenantId = generateId();
      const producerId: TenantId = generateId();
      const eserviceId: EServiceId = generateId();
      const descriptorId: DescriptorId = generateId();
      const tokenDurationInSeconds = 1000;

      const digest: ClientAssertionDigest = {
        alg: algorithm.RS256,
        value: "valid-digest-value",
      };

      const interopTokenGenerator = new InteropTokenGenerator(
        authServerConfig,
        kmsClient
      );

      const actualToken =
        await interopTokenGenerator.generateInteropConsumerToken({
          sub: subClientId,
          audience,
          purposeId,
          tokenDurationInSeconds,
          digest,
          producerId,
          consumerId,
          eserviceId,
          descriptorId,
          featureFlagImprovedProducerVerificationClaims: false,
        });

      expect(actualToken.header).toEqual({
        alg: algorithm.RS256,
        use: "sig",
        typ: "at+jwt",
        kid: authServerConfig.generatedInteropTokenKid,
      });

      const decodedActualToken = deserializeJWT(actualToken.serialized);

      // Interop Consumer token payload don't have custom claims
      expect(decodedActualToken).toEqual({
        jti: expect.any(String),
        iss: authServerConfig.generatedInteropTokenIssuer,
        aud: audience.join(","),
        iat: mockTimeStamp,
        nbf: mockTimeStamp,
        exp: mockTimeStamp + tokenDurationInSeconds,
        client_id: subClientId,
        sub: subClientId,
        purposeId,
        digest,
      });
    });

    it("should have Interop Consumer standard token claims and the DPoP thumbprint", async () => {
      const subClientId: ClientId = generateId();
      const audience = ["Audience1", "Audience2"];
      const purposeId = generateId<PurposeId>();
      const consumerId: TenantId = generateId();
      const producerId: TenantId = generateId();
      const eserviceId: EServiceId = generateId();
      const descriptorId: DescriptorId = generateId();
      const tokenDurationInSeconds = 1000;
      const { dpopProofJWT } = await getMockDPoPProof();

      const digest: ClientAssertionDigest = {
        alg: algorithm.RS256,
        value: "valid-digest-value",
      };

      const interopTokenGenerator = new InteropTokenGenerator(
        authServerConfig,
        kmsClient
      );

      const actualToken =
        await interopTokenGenerator.generateInteropConsumerToken({
          sub: subClientId,
          audience,
          purposeId,
          tokenDurationInSeconds,
          digest,
          producerId,
          consumerId,
          eserviceId,
          descriptorId,
          featureFlagImprovedProducerVerificationClaims: false,
          dpopJWK: dpopProofJWT?.header.jwk,
        });

      expect(actualToken.header).toEqual({
        alg: algorithm.RS256,
        use: "sig",
        typ: "at+jwt",
        kid: authServerConfig.generatedInteropTokenKid,
      });

      const decodedActualToken = deserializeJWT(actualToken.serialized);

      // Interop Consumer token payload don't have custom claims
      expect(decodedActualToken).toEqual({
        jti: expect.any(String),
        iss: authServerConfig.generatedInteropTokenIssuer,
        aud: audience.join(","),
        iat: mockTimeStamp,
        nbf: mockTimeStamp,
        exp: mockTimeStamp + tokenDurationInSeconds,
        client_id: subClientId,
        sub: subClientId,
        purposeId,
        digest,
        cnf: {
          jkt: calculateKid(dpopProofJWT?.header.jwk),
        },
      });
    });
  });

  describe("Internal JWT Token", () => {
    it("should have Internal token claims", async () => {
      const interopTokenGenerator = new InteropTokenGenerator(
        interopTokenGenerationConfig,
        kmsClient
      );

      const actualToken = await interopTokenGenerator.generateInternalToken();

      expect(actualToken.header).toEqual({
        alg: algorithm.RS256,
        use: "sig",
        typ: "at+jwt",
        kid: interopTokenGenerationConfig.kid,
      });

      const decodedActualToken = deserializeJWT(actualToken.serialized);

      // Interop Consumer token payload don't have custom claims
      expect(decodedActualToken).toEqual({
        jti: expect.any(String),
        iss: interopTokenGenerationConfig.issuer,
        aud: interopTokenGenerationConfig.audience.join(","),
        sub: interopTokenGenerationConfig.subject,
        iat: mockTimeStamp,
        nbf: mockTimeStamp,
        exp: mockTimeStamp + interopTokenGenerationConfig.secondsDuration,
        role: "internal",
      });
    });
  });
});
