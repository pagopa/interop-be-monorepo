/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AuthData, UserRole } from "pagopa-interop-commons";
import { match } from "ts-pattern";

function createUserPayload(authData: AuthData) {
  return {
    iss: "dev.interop.pagopa.it",
    aud: "dev.interop.pagopa.it/ui",
    uid: authData.userId,
    nbf: Math.floor(Date.now() / 1000),
    name: "Mario",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    family_name: "Rossi",
    jti: "1bca86f5-e913-4fce-bc47-2803bde44d2b",
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

function createInternalPayload(authData: AuthData) {
  return {
    iss: "dev.interop.pagopa.it",
    aud: "dev.interop.pagopa.it/ui",
    uid: authData.userId,
    nbf: Math.floor(Date.now() / 1000),
    name: "Mario",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    family_name: "Rossi",
    jti: "1bca86f5-e913-4fce-bc47-2803bde44d2b",
    email: "Mario.rossi@psp.it",
    role: "internal",
    sub: authData.userId,
    organization: {
      id: authData.selfcareId,
      name: "PagoPA S.p.A.",
      roles: [
        {
          partyRole: "MANAGER",
          role: ["internal"],
        },
      ],
      fiscal_code: "15376371009",
      ipaCode: "5N2TR557",
    },
    "user-roles": "internal",
  };
}

const uiRoles: UserRole[] = ["admin", "api", "security", "support"];

export const createPayload = (authData: AuthData) =>
  match(authData.userRoles)
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
