import {
  AuthRole,
  userRole,
  InteropJwtMaintenancePayload,
  InteropJwtApiM2MAdminPayload,
  InteropJwtApiM2MPayload,
  InteropJwtInternalPayload,
  SerializedAuthTokenPayload,
} from "pagopa-interop-commons";
import { ClientId, UserId, generateId } from "pagopa-interop-models";
import { match } from "ts-pattern";
import jwt from "jsonwebtoken";

function createUserPayload(
  commaSeparatedUserRoles: string
): SerializedAuthTokenPayload {
  const organizationId = generateId();
  return {
    iss: "dev.interop.pagopa.it",
    aud: ["dev.interop.pagopa.it/ui"],
    exp: Math.floor(Date.now() / 1000) + 3600,
    nbf: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000),
    jti: "1bca86f5-e913-4fce-bc47-2803bde44d2b",
    uid: generateId(),
    name: "Mario",
    family_name: "Rossi",
    email: "Mario.rossi@psp.it",
    organization: {
      id: organizationId,
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
    organizationId,
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
    aud: ["dev.interop.pagopa.it/ui"],
    exp: Math.floor(Date.now() / 1000) + 3600,
    nbf: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000),
    jti: "1bca86f5-e913-4fce-bc47-2803bde44d2b",
    role: "maintenance",
    sub: "interop.testing",
  };
}

function createM2MPayload(): InteropJwtApiM2MPayload {
  return {
    iss: "dev.interop.pagopa.it",
    aud: ["dev.interop.pagopa.it/ui"],
    exp: Math.floor(Date.now() / 1000) + 3600,
    nbf: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000),
    jti: "1bca86f5-e913-4fce-bc47-2803bde44d2b",
    role: "m2m",
    organizationId: generateId(),
    client_id: generateId(),
    sub: generateId(),
  };
}

function createInternalPayload(): InteropJwtInternalPayload {
  return {
    iss: "dev.interop.pagopa.it",
    aud: ["dev.interop.pagopa.it/ui"],
    exp: Math.floor(Date.now() / 1000) + 3600,
    nbf: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000),
    jti: "1bca86f5-e913-4fce-bc47-2803bde44d2b",
    role: "internal",
    sub: "interop.testing",
  };
}

export const mockM2MAdminClientId = generateId<ClientId>();
export const mockM2MAdminUserId: UserId = generateId();
// ^ ID of the client and the admin user associated with the client.
// Mocked and exported because in the M2M gateway we need to
// validate the admin ID in the token against the adminId in the client.
function createM2MAdminPayload(): InteropJwtApiM2MAdminPayload {
  return {
    iss: "dev.interop.pagopa.it",
    aud: ["dev.interop.pagopa.it/ui"],
    exp: Math.floor(Date.now() / 1000) + 3600,
    nbf: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000),
    jti: "1bca86f5-e913-4fce-bc47-2803bde44d2b",
    role: "m2m-admin",
    organizationId: generateId(),
    client_id: mockM2MAdminClientId,
    sub: mockM2MAdminClientId,
    adminId: mockM2MAdminUserId,
  };
}

export const createPayload = (
  role: AuthRole
): SerializedAuthTokenPayload | InteropJwtMaintenancePayload =>
  match(role)
    .with("maintenance", () => createMaintenancePayload())
    .with("m2m", () => createM2MPayload())
    .with("m2m-admin", () => createM2MAdminPayload())
    .with("internal", () => createInternalPayload())
    .with("admin", () => createUserPayload(userRole.ADMIN_ROLE))
    .with("api", () => createUserPayload(userRole.API_ROLE))
    .with("security", () => createUserPayload(userRole.SECURITY_ROLE))
    .with("support", () => createUserPayload(userRole.SUPPORT_ROLE))
    .exhaustive();

export const generateToken = (role: AuthRole): string =>
  jwt.sign(createPayload(role), "test-secret");
