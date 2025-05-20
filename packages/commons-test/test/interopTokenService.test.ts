import {
  AuthorizationServerTokenGenerationConfig,
  CustomClaims,
  InteropTokenGenerator,
  SessionTokenGenerationConfig,
  TokenGenerationConfig,
  UserRole,
  b64ByteUrlDecode,
  dateToSeconds,
  userRole,
} from "pagopa-interop-commons";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  ClientAssertionDigest,
  ClientId,
  generateId,
  PurposeId,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import { KMSClient } from "@aws-sdk/client-kms";
import { getMockCustomClaims, getMockSessionClaims } from "../src/testUtils.js";

const deserializeJWT = (jwt: string): JSON =>
  b64ByteUrlDecode(jwt.split(".")[1]);

describe("Token Generator", () => {
  const mockDate = new Date();
  const mockTimeStamp = dateToSeconds(new Date());

  const authServerConfig: AuthorizationServerTokenGenerationConfig = {
    generatedInteropTokenKid: generateId(),
    generatedInteropTokenIssuer: "Interop Issuer",
    generatedInteropTokenM2MAudience: "M2M Audience",
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
    expectedClaims: CustomClaims
  ): void => {
    expect(payload).toMatchObject({
      "user-roles": expectedClaims["user-roles"],
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
    it("should token have a Session claims for multiple user roles: api,security", async () => {
      const claims = {
        ...getMockSessionClaims(),
        ...getMockCustomClaims([userRole.API_ROLE, userRole.SECURITY_ROLE]),
      };

      const interopTokenGenerator = new InteropTokenGenerator(
        sessionTokenGenerationConfig,
        kmsClient
      );

      const actualToken = await interopTokenGenerator.generateSessionToken(
        claims,
        1000
      );
      expect(actualToken.header).toEqual({
        alg: "RS256",
        use: "sig",
        typ: "at+jwt",
        kid: sessionTokenGenerationConfig.generatedKid,
      });

      const decodedActualToken = deserializeJWT(actualToken.serialized);

      expect(decodedActualToken).toMatchObject({
        jti: expect.any(String),
        iss: sessionTokenGenerationConfig.generatedIssuer,
        aud: sessionTokenGenerationConfig.generatedAudience,
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
        organizationId: claims.organizationId,
      });
    });

    it.each(Object.values(userRole))(
      "should token have a Session claims for role %s",
      async (role: UserRole) => {
        const claims = {
          ...getMockSessionClaims(),
          ...getMockCustomClaims([role]),
        };

        const interopTokenGenerator = new InteropTokenGenerator(
          sessionTokenGenerationConfig,
          kmsClient
        );

        const actualToken = await interopTokenGenerator.generateSessionToken(
          claims,
          1000
        );
        expect(actualToken.header).toEqual({
          alg: "RS256",
          use: "sig",
          typ: "at+jwt",
          kid: sessionTokenGenerationConfig.generatedKid,
        });

        const decodedActualToken = deserializeJWT(actualToken.serialized);

        expect(decodedActualToken).toMatchObject({
          jti: expect.any(String),
          iss: sessionTokenGenerationConfig.generatedIssuer,
          aud: sessionTokenGenerationConfig.generatedAudience,
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
        alg: "RS256",
        use: "sig",
        typ: "at+jwt",
        kid: authServerConfig.generatedInteropTokenKid,
      });

      const decodedActualToken = deserializeJWT(actualToken.serialized);

      expect(decodedActualToken).toMatchObject({
        jti: expect.any(String),
        iss: authServerConfig.generatedInteropTokenIssuer,
        aud: authServerConfig.generatedInteropTokenM2MAudience,
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
        alg: "RS256",
        use: "sig",
        typ: "at+jwt",
        kid: authServerConfig.generatedInteropTokenKid,
      });

      const decodedActualToken = deserializeJWT(actualToken.serialized);
      expect(decodedActualToken).toBeDefined();

      expect(decodedActualToken).toMatchObject({
        jti: expect.any(String),
        iss: authServerConfig.generatedInteropTokenIssuer,
        aud: authServerConfig.generatedInteropTokenM2MAudience,
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
  });

  describe("Consumer JWT Token", () => {
    it("should have Interop Consumer token claims", async () => {
      const subClientId: ClientId = generateId();
      const audience = ["Audience1", "Audience2"];
      const purposeId = generateId<PurposeId>();
      const tokenDurationInSeconds = 1000;

      const digest: ClientAssertionDigest = {
        alg: "RS256",
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
        });

      expect(actualToken.header).toEqual({
        alg: "RS256",
        use: "sig",
        typ: "at+jwt",
        kid: authServerConfig.generatedInteropTokenKid,
      });

      const decodedActualToken = deserializeJWT(actualToken.serialized);

      // Interop Consumer token payload don't have custom claims
      expect(decodedActualToken).toEqual({
        jti: expect.any(String),
        iss: authServerConfig.generatedInteropTokenIssuer,
        aud: audience,
        iat: mockTimeStamp,
        nbf: mockTimeStamp,
        exp: mockTimeStamp + tokenDurationInSeconds,
        client_id: subClientId,
        sub: subClientId,
        purposeId,
        digest,
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
        alg: "RS256",
        use: "sig",
        typ: "at+jwt",
        kid: interopTokenGenerationConfig.kid,
      });

      const decodedActualToken = deserializeJWT(actualToken.serialized);

      // Interop Consumer token payload don't have custom claims
      expect(decodedActualToken).toEqual({
        jti: expect.any(String),
        iss: interopTokenGenerationConfig.issuer,
        aud: interopTokenGenerationConfig.audience,
        sub: interopTokenGenerationConfig.subject,
        iat: mockTimeStamp,
        nbf: mockTimeStamp,
        exp: mockTimeStamp + interopTokenGenerationConfig.secondsDuration,
        role: "internal",
      });
    });
  });
});
