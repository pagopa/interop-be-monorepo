/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AuthData, UserRole } from "pagopa-interop-commons";
import { generateId } from "pagopa-interop-models";
import { match } from "ts-pattern";

function createUserPayload(authData: AuthData) {
  return {
    iss: "dev.interop.pagopa.it",
    aud: "dev.interop.pagopa.it/ui",
    exp: Math.floor(Date.now() / 1000) + 3600,
    nbf: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000),
    jti: "1bca86f5-e913-4fce-bc47-2803bde44d2b",
    uid: authData.userId,
    name: "Mario",
    family_name: "Rossi",
    email: "Mario.rossi@psp.it",
    ...authData,
    organization: {
      id: authData.selfcareId,
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
    "user-roles": authData.userRoles.join(","),
  };
}

function createMaintenancePayload(authData: AuthData) {
  return {
    iss: "dev.interop.pagopa.it",
    aud: "dev.interop.pagopa.it/ui",
    exp: Math.floor(Date.now() / 1000) + 3600,
    uid: authData.userId,
    nbf: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000),
    jti: "1bca86f5-e913-4fce-bc47-2803bde44d2b",
    role: "maintenance",
    sub: authData.userId,
  };
}

function createM2MPayload(authData: AuthData) {
  return {
    iss: "dev.interop.pagopa.it",
    aud: "dev.interop.pagopa.it/ui",
    exp: Math.floor(Date.now() / 1000) + 3600,
    nbf: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000),
    jti: "1bca86f5-e913-4fce-bc47-2803bde44d2b",
    role: "m2m",
    organizationId: authData.organizationId,
    client_id: generateId(),
    sub: authData.userId,
  };
}

function createInternalPayload(authData: AuthData) {
  return {
    iss: "dev.interop.pagopa.it",
    aud: "dev.interop.pagopa.it/ui",
    exp: Math.floor(Date.now() / 1000) + 3600,
    uid: authData.userId,
    nbf: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000),
    jti: "1bca86f5-e913-4fce-bc47-2803bde44d2b",
    role: "internal",
    sub: authData.userId,
  };
}

const uiRoles: UserRole[] = ["admin", "api", "security", "support"];

export const createPayload = (authData: AuthData) =>
  match(authData.userRoles)
    .when(
      (roles) => roles.includes("maintenance"),
      () => createMaintenancePayload(authData)
    )
    .when(
      (roles) => roles.includes("m2m"),
      () => createM2MPayload(authData)
    )
    .when(
      (roles) => roles.includes("internal"),
      () => createInternalPayload(authData)
    )
    .when(
      (roles) => uiRoles.some((role) => roles.includes(role)),
      () => createUserPayload(authData)
    )
    .otherwise(() => {
      throw Error("Unexpexted Role");
    });
