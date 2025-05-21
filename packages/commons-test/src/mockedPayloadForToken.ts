import {
  AuthRole,
  InteropJwtMaintenancePayload,
  InteropJwtApiM2MAdminPayload,
  InteropJwtApiM2MPayload,
  InteropJwtInternalPayload,
  UserRole,
  SerializedAuthTokenPayload,
} from "pagopa-interop-commons";
import { ClientId, UserId, generateId } from "pagopa-interop-models";
import { match } from "ts-pattern";
import jwt from "jsonwebtoken";

function createUserPayload(roles: UserRole[]): SerializedAuthTokenPayload {
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
    "user-roles": roles.join(","),
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
  roles: AuthRole[]
): SerializedAuthTokenPayload | InteropJwtMaintenancePayload =>
  match(roles)
    .with(["maintenance"], () => createMaintenancePayload())
    .with(["m2m"], () => createM2MPayload())
    .with(["m2m-admin"], () => createM2MAdminPayload())
    .with(["internal"], () => createInternalPayload())
    .otherwise(() => createUserPayload(roles as UserRole[]));

export const generateToken = (roles: AuthRole[]): string =>
  jwt.sign(createPayload(roles), "test-secret");
