import jwt from "jsonwebtoken";
import {
  AuthRole,
  InteropJwtMaintenancePayload,
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
