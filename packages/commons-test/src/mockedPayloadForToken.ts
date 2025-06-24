import jwt from "jsonwebtoken";
import {
  AuthRole,
  InteropJwtMaintenancePayload,
  SerializedInteropJwtApiPayload,
  SerializedInteropJwtInternalPayload,
  SerializedInteropJwtUIPayload,
  systemRole,
  userRole,
} from "pagopa-interop-commons";
import {
  ClientId,
  TenantId,
  UserId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

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

export function createPayload<T extends keyof RolePayloadsMap>(
  role: T
): ReturnType<RolePayloadsMap[T]> {
  return match<AuthRole>(role)
    .with(systemRole.MAINTENANCE_ROLE, () => createMaintenancePayload())
    .with(systemRole.M2M_ROLE, () => createM2MPayload())
    .with(systemRole.M2M_ADMIN_ROLE, () => createM2MAdminPayload())
    .with(systemRole.INTERNAL_ROLE, () => createInternalPayload())
    .with(
      userRole.ADMIN_ROLE,
      userRole.API_ROLE,
      userRole.SECURITY_ROLE,
      userRole.SUPPORT_ROLE,
      (r) => rolePayloadMap[r](r)
    )
    .exhaustive() as ReturnType<RolePayloadsMap[T]>;
}

export const generateToken = (role: AuthRole): string =>
  signPayload(createPayload(role));

export const signPayload = (payload: object): string =>
  jwt.sign(payload, "test-secret");

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
    uid: generateId(),
    name: "Mario",
    family_name: "Rossi",
    email: "Mario.rossi@psp.it",
    organization: {
      id: generateId(),
      name: "PagoPA S.p.A.",
      roles: [
        {
          partyRole: "MANAGER",
          role: "admin",
        },
      ],
      fiscal_code: "15376371009",
      ipaCode: "5N2TR557",
    },
    "user-roles": commaSeparatedUserRoles,
    organizationId: mockTokenOrganizationId,
    externalId: {
      value: "123456",
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

export function createUIPayload(): SerializedInteropJwtUIPayload {
  return {
    iss: "dev.interop.pagopa.it",
    externalId: {
      origin: "IPA",
      value: "5N2TR557",
    },
    "user-roles": [userRole.SECURITY_ROLE, userRole.API_ROLE].join(","),
    selfcareId: unsafeBrandId("1962d21c-c701-4805-93f6-53a877898756"),
    organizationId: unsafeBrandId("69e2865e-65ab-4e48-a638-2037a9ee2ee7"),
    aud: "dev.interop.pagopa.it/ui,interop.pagopa.it/ui",
    uid: unsafeBrandId("f07ddb8f-17f9-47d4-b31e-35d1ac10e521"),
    nbf: 1710841859,
    organization: {
      id: unsafeBrandId("1962d21c-c701-4805-93f6-53a877898756"),
      name: "PagoPA S.p.A.",
      roles: [
        {
          partyRole: "MANAGER",
          role: userRole.ADMIN_ROLE,
        },
      ],
      fiscal_code: "15376371009",
      ipaCode: "5N2TR557",
    },
    name: "Mario",
    exp: 1710928259,
    iat: 1710841859,
    family_name: "Rossi",
    jti: "e82bd774-9cac-4885-931b-015b2eb4e9a5",
    email: "m.rossi@psp.it",
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
