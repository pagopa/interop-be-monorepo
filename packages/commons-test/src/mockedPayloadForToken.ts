/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AuthRole, userRole } from "pagopa-interop-commons";
import { generateId } from "pagopa-interop-models";
import { match } from "ts-pattern";
import jwt from "jsonwebtoken";
import { getMockAuthData } from "./testUtils.js";

function createUserPayload(role: AuthRole) {
  return {
    iss: "dev.interop.pagopa.it",
    aud: "dev.interop.pagopa.it/ui",
    exp: Math.floor(Date.now() / 1000) + 3600,
    nbf: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000),
    jti: "1bca86f5-e913-4fce-bc47-2803bde44d2b",
    uid: generateId(),
    name: "Mario",
    family_name: "Rossi",
    email: "Mario.rossi@psp.it",
    ...getMockAuthData(),
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
    "user-roles": role,
  };
}

function createMaintenancePayload() {
  return {
    iss: "dev.interop.pagopa.it",
    aud: "dev.interop.pagopa.it/ui",
    exp: Math.floor(Date.now() / 1000) + 3600,
    nbf: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000),
    jti: "1bca86f5-e913-4fce-bc47-2803bde44d2b",
    role: "maintenance",
    sub: "interop.testing",
  };
}

function createM2MPayload() {
  return {
    iss: "dev.interop.pagopa.it",
    aud: "dev.interop.pagopa.it/ui",
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

function createInternalPayload() {
  return {
    iss: "dev.interop.pagopa.it",
    aud: "dev.interop.pagopa.it/ui",
    exp: Math.floor(Date.now() / 1000) + 3600,
    nbf: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000),
    jti: "1bca86f5-e913-4fce-bc47-2803bde44d2b",
    role: "internal",
    sub: "interop.testing",
  };
}

function createM2M_AdminPayload() {
  return {
    iss: "dev.interop.pagopa.it",
    aud: "dev.interop.pagopa.it/ui",
    userId: generateId(),
    exp: Math.floor(Date.now() / 1000) + 3600,
    nbf: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000),
    jti: "1bca86f5-e913-4fce-bc47-2803bde44d2b",
    role: "m2m-admin",
    organizationId: generateId(),
    client_id: generateId(),
    sub: generateId(),
  };
}

const createPayload = (role: AuthRole) =>
  match(role)
    .with("maintenance", () => createMaintenancePayload())
    .with("m2m", () => createM2MPayload())
    .with("m2m-admin", () => createM2M_AdminPayload())
    .with("internal", () => createInternalPayload())
    .with("admin", () => createUserPayload(userRole.ADMIN_ROLE))
    .with("api", () => createUserPayload(userRole.API_ROLE))
    .with("security", () => createUserPayload(userRole.SECURITY_ROLE))
    .with("support", () => createUserPayload(userRole.SUPPORT_ROLE))
    .exhaustive();

export const generateToken = (role: AuthRole) =>
  jwt.sign(createPayload(role), "test-secret");
