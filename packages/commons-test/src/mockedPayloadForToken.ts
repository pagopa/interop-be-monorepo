import { createHash } from "crypto";
import {
  generateKeyPair,
  exportJWK,
  calculateJwkThumbprint,
  SignJWT,
  JWK,
  exportSPKI,
} from "jose";
import jwt from "jsonwebtoken";
import {
  AuthRole,
  InteropJwtMaintenancePayload,
  SerializedInteropJwtApiDPoPPayload,
  SerializedInteropJwtApiPayload,
  SerializedInteropJwtInternalPayload,
  SerializedInteropJwtUIPayload,
  systemRole,
  UserRole,
  userRole,
} from "pagopa-interop-commons";
import { ClientId, TenantId, UserId, generateId } from "pagopa-interop-models";

/**
 * Maps authentication roles to their corresponding payload creator functions.
 *
 * This mapping associates each role defined in {@link AuthRole} with a function
 * that generates the appropriate serialized JWT payload.
 * This mapping is used in createPayload function to guarantee that the returned
 * value have the correct type according to the role passed as argument.
 *
 * The TypeScript `satisfies` operator providing type safety ensures that:
 * - each role in the `AuthRole` type has a corresponding function in this map.
 * - if a role is added to the `AuthRole` type without a corresponding function in
 *   this map, a compile-time error will be raised.
 * - if a role does not have a corresponding function, a compile-time error will be raised
 * - the return type of the createPayload functions can be inferred correctly
 */
const rolePayloadMap = {
  [systemRole.M2M_ROLE]: createM2MPayload,
  [systemRole.M2M_ADMIN_ROLE]: createM2MAdminPayload,
  [systemRole.INTERNAL_ROLE]: createInternalPayload,
  [systemRole.MAINTENANCE_ROLE]: createMaintenancePayload,
  [userRole.ADMIN_ROLE]: createUserPayload,
  [userRole.API_ROLE]: createUserPayload,
  [userRole.SECURITY_ROLE]: createUserPayload,
  [userRole.SUPPORT_ROLE]: createUserPayload,
  // the `satisfies` ensures that all roles will have a corresponding creator function
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} satisfies Record<AuthRole, (...args: any) => any>;

type RolePayloadsMap = typeof rolePayloadMap;

/**
 * Creates and returns a properly typed JWT payload based on the provided authorization role {@link AuthRole}
 *
 * @template T - The role type which must be a key of RolePayloadsMap
 * @param {T} role - The authorization role {@link AuthRole} type
 * @returns {ReturnType<RolePayloadsMap[T]>} - The JWT payload typed in accordance with the function
 * corresponding to the provided role defined in {@link RolePayloadsMap}.
 *
 * @example
 * Create a payload for a m2m role return value typed as SerializedInteropJwtApiPayload
 * const mockM2MTokenPayload: SerializedInteropJwtApiPayload = createPayload(systemRole.M2M_ROLE);
 */
export function createPayload<T extends keyof RolePayloadsMap>(
  role: T
): ReturnType<RolePayloadsMap[T]> {
  return rolePayloadMap[role](role) as ReturnType<RolePayloadsMap[T]>;
}

export const generateToken = (role: AuthRole): string =>
  signPayload(createPayload(role));

export const signPayload = (payload: object): string =>
  jwt.sign(payload, "test-secret");

export const mockTokenUserId = generateId<UserId>();

export const mockTokenOrganizationId = generateId<TenantId>();
export const mockM2MAdminClientId = generateId<ClientId>();
export const mockM2MAdminUserId: UserId = generateId();
// ^ ID of the client and the admin user associated with the client.
// Mocked and exported because in the M2M gateway we need to
// validate the admin ID in the token against the adminId in the client.

export function createUserPayload(
  commaSeparatedUserRoles: string
): SerializedInteropJwtUIPayload {
  return {
    iss: "dev.interop.pagopa.it",
    aud: "dev.interop.pagopa.it/ui,interop.pagopa.it/ui",
    exp: Math.floor(Date.now() / 1000) + 3600,
    nbf: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000),
    jti: "1bca86f5-e913-4fce-bc47-2803bde44d2b",
    uid: mockTokenUserId,
    name: "Mario",
    family_name: "Rossi",
    email: "Mario.rossi@psp.it",
    organization: {
      id: generateId(),
      name: "PagoPA S.p.A.",
      roles: commaSeparatedUserRoles.split(",").map((role) => ({
        partyRole: "MANAGER",
        role: UserRole.parse(role),
      })),
      fiscal_code: "15376371009",
      ipaCode: "5N2TR557",
    },
    "user-roles": commaSeparatedUserRoles,
    organizationId: mockTokenOrganizationId,
    externalId: {
      value: "5N2TR557",
      origin: "IPA",
    },
    selfcareId: generateId(),
  };
}

function createMaintenancePayload(): InteropJwtMaintenancePayload {
  return {
    iss: "dev.interop.pagopa.it",
    aud: ["dev.interop.pagopa.it/maintenance", "interop.pagopa.it/maintenance"],
    exp: Math.floor(Date.now() / 1000) + 3600,
    nbf: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000),
    jti: "1bca86f5-e913-4fce-bc47-2803bde44d2b",
    role: systemRole.MAINTENANCE_ROLE,
    sub: "interop.testing",
  };
}

function createM2MPayload(): SerializedInteropJwtApiPayload {
  return {
    iss: "dev.interop.pagopa.it",
    aud: "dev.interop.pagopa.it/m2m,interop.pagopa.it/m2m",
    exp: Math.floor(Date.now() / 1000) + 3600,
    nbf: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000),
    jti: "1bca86f5-e913-4fce-bc47-2803bde44d2b",
    role: systemRole.M2M_ROLE,
    organizationId: mockTokenOrganizationId,
    client_id: generateId(),
    sub: generateId(),
  };
}

function createInternalPayload(): SerializedInteropJwtInternalPayload {
  return {
    iss: "dev.interop.pagopa.it",
    aud: "dev.interop.pagopa.it/ui",
    exp: Math.floor(Date.now() / 1000) + 3600,
    nbf: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000),
    jti: "1bca86f5-e913-4fce-bc47-2803bde44d2b",
    role: systemRole.INTERNAL_ROLE,
    sub: "interop.testing",
  };
}

function createM2MAdminPayload(): SerializedInteropJwtApiPayload {
  return {
    iss: "dev.interop.pagopa.it",
    aud: "dev.interop.pagopa.it/m2m,interop.pagopa.it/m2m",
    exp: Math.floor(Date.now() / 1000) + 3600,
    nbf: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000),
    jti: "1bca86f5-e913-4fce-bc47-2803bde44d2b",
    role: systemRole.M2M_ADMIN_ROLE,
    organizationId: mockTokenOrganizationId,
    client_id: mockM2MAdminClientId,
    sub: mockM2MAdminClientId,
    adminId: mockM2MAdminUserId,
  };
}

function createM2MAdminDPoPPayload({
  cnf,
  jti,
}: {
  cnf: string;
  jti: string;
}): SerializedInteropJwtApiDPoPPayload {
  return {
    iss: "dev.interop.pagopa.it",
    aud: "dev.interop.pagopa.it/m2m",
    exp: Math.floor(Date.now() / 1000) + 3600,
    nbf: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000),
    jti,
    role: systemRole.M2M_ADMIN_ROLE,
    organizationId: mockTokenOrganizationId,
    client_id: mockM2MAdminClientId,
    sub: mockM2MAdminClientId,
    adminId: mockM2MAdminUserId,
    cnf: {
      jkt: cnf,
    },
  };
}

type ExpectedAuthData = {
  clientId: string;
  jti: string;
  organizationId: string;
  systemRole: "m2m_admin";
  userId: string;
};

type GeneratedDPoPBundle = {
  jti: string;
  accessToken: string;
  accessTokenWithoutCnf: string;
  accessTokenWithDifferentCnf: string;
  expiredAccessToken: string;
  dpopProof: string;
  expiredDpopProof: string;
  dpopProofWithWrongAth: string;
  dpopPoroofWithoutAth: string;
  dpopPublicJwk: JWK;
  authServerPublicJwk: JWK;
  authServerPublicKeyPem: string;
  expectedAuthData: ExpectedAuthData;
};

export async function generateM2MAdminAccessTokenWithDPoPProof({
  htu,
  htm,
  jti,
}: {
  htu: string;
  htm?: string;
  jti?: string;
}): Promise<GeneratedDPoPBundle> {
  // ===============================
  // 0) Generate JTI (if not passed)
  // ===============================
  const definedJti = jti ?? crypto.randomUUID();
  // ===============================
  // 1) Generate DPoP client keypair
  // ===============================
  const { publicKey: dpopPublicKey, privateKey: dpopPrivateKey } =
    await generateKeyPair("ES256");

  const dpopPublicJwk = await exportJWK(dpopPublicKey);
  // eslint-disable-next-line functional/immutable-data
  dpopPublicJwk.alg = "ES256";
  // eslint-disable-next-line functional/immutable-data
  dpopPublicJwk.use = "sig";

  const dpopThumbprint = await calculateJwkThumbprint(dpopPublicJwk);

  // 1b) Create different cnf
  const { publicKey: dpopPublicKeyForDifferentCnf } = await generateKeyPair(
    "ES256"
  );

  const dpopPublicJwkForDifferentCnf = await exportJWK(
    dpopPublicKeyForDifferentCnf
  );
  // eslint-disable-next-line functional/immutable-data
  dpopPublicJwkForDifferentCnf.alg = "ES256";
  // eslint-disable-next-line functional/immutable-data
  dpopPublicJwkForDifferentCnf.use = "sig";

  const dpopThumbprintForDifferentCnf = await calculateJwkThumbprint(
    dpopPublicJwkForDifferentCnf
  );

  // ===============================
  // 2) Generate Auth Server keypair
  // ===============================
  const { publicKey: authPublicKey, privateKey: authPrivateKey } =
    await generateKeyPair("RS256");

  const authServerPublicJwk = await exportJWK(authPublicKey);
  // eslint-disable-next-line functional/immutable-data
  authServerPublicJwk.alg = "RS256";
  // eslint-disable-next-line functional/immutable-data
  authServerPublicJwk.use = "sig";
  // eslint-disable-next-line functional/immutable-data
  authServerPublicJwk.kid = "test-auth-server-key";

  const authServerPublicKeyPem = await exportSPKI(authPublicKey);

  // ===============================
  // 3) Create access token payload
  // ===============================
  const payload = createM2MAdminDPoPPayload({
    cnf: dpopThumbprint,
    jti: definedJti,
  });

  // ===============================
  // 4) Sign access token (AUTH SERVER)
  // ===============================
  const accessToken = await new SignJWT(payload)
    .setProtectedHeader({
      alg: "RS256",
      kid: authServerPublicJwk.kid,
      typ: "JWT",
    })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(authPrivateKey);

  // 4b) Create access token without cnf payload
  const accessTokenWithoutCnf = await new SignJWT({
    ...payload,
    cnf: undefined,
  })
    .setProtectedHeader({
      alg: "RS256",
      kid: authServerPublicJwk.kid,
      typ: "JWT",
    })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(authPrivateKey);

  // 4c) Create access token with different cnf
  const accessTokenWithDifferentCnf = await new SignJWT({
    ...payload,
    cnf: {
      jkt: dpopThumbprintForDifferentCnf,
    },
  })
    .setProtectedHeader({
      alg: "RS256",
      kid: authServerPublicJwk.kid,
      typ: "JWT",
    })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(authPrivateKey);

  // 4d) Create an expired access token
  const nowInSeconds: number = Math.floor(Date.now() / 1000);

  const expiredAccessToken: string = await new SignJWT(payload)
    .setProtectedHeader({
      alg: "RS256",
      kid: authServerPublicJwk.kid,
      typ: "JWT",
    })
    .setIssuedAt(nowInSeconds - 7200) // issued 2h ago
    .setExpirationTime(nowInSeconds - 3600) // expired 1h ago
    .sign(authPrivateKey);

  // ===============================
  // 5) Create DPoP proof (CLIENT)
  // ===============================
  const { kty, crv, x, y } = dpopPublicJwk;
  const minimalJwkForDpopHeader = { kty, crv, x, y };
  const dpopProof = await new SignJWT({
    htm: htm ?? "GET",
    htu,
    ath: createHash("sha256").update(accessToken).digest("base64url"),
  })
    .setProtectedHeader({
      alg: "ES256",
      typ: "dpop+jwt",
      jwk: minimalJwkForDpopHeader,
    })
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .sign(dpopPrivateKey);

  // 5b) Create expired DPoP Proof
  const expiredDpopProof: string = await new SignJWT({
    htm: htm ?? "GET",
    htu,
  })
    .setProtectedHeader({
      alg: "ES256",
      typ: "dpop+jwt",
      jwk: minimalJwkForDpopHeader,
    })
    .setJti(crypto.randomUUID())
    .setIssuedAt(nowInSeconds - 7200) // 2h ago
    .setExpirationTime(nowInSeconds - 3600) // expired 1h ago
    .sign(dpopPrivateKey);

  // 5c) Create DPoP proof with wrong ath
  const dpopProofWithWrongAth = await new SignJWT({
    htm: htm ?? "GET",
    htu,
    ath: "wrong-ath",
  })
    .setProtectedHeader({
      alg: "ES256",
      typ: "dpop+jwt",
      jwk: minimalJwkForDpopHeader,
    })
    .setJti(crypto.randomUUID())
    .setIssuedAt(nowInSeconds - 7200) // 2h ago
    .setExpirationTime(nowInSeconds - 3600) // expired 1h ago
    .sign(dpopPrivateKey);

  // 5d) Create DPoP proof without ath
  const dpopPoroofWithoutAth = await new SignJWT({
    htm: htm ?? "GET",
    htu,
  })
    .setProtectedHeader({
      alg: "ES256",
      typ: "dpop+jwt",
      jwk: minimalJwkForDpopHeader,
    })
    .setJti(crypto.randomUUID())
    .setIssuedAt(nowInSeconds - 7200) // 2h ago
    .setExpirationTime(nowInSeconds - 3600) // expired 1h ago
    .sign(dpopPrivateKey);
  return {
    jti: definedJti,
    accessToken,
    accessTokenWithoutCnf,
    accessTokenWithDifferentCnf,
    expiredAccessToken,
    dpopProof,
    expiredDpopProof,
    dpopProofWithWrongAth,
    dpopPoroofWithoutAth,
    dpopPublicJwk,
    authServerPublicJwk,
    authServerPublicKeyPem,
    expectedAuthData: {
      clientId: payload.client_id,
      jti: payload.jti,
      organizationId: payload.organizationId,
      systemRole: payload.role as "m2m_admin",
      userId: (payload as { adminId: string }).adminId,
    },
  };
}
