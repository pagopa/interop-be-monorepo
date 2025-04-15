/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AuthData, M2MAuthData, UIAuthData } from "pagopa-interop-commons";
import { generateId } from "pagopa-interop-models";
import { match } from "ts-pattern";

function createUserPayload(authData: UIAuthData) {
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

function createM2MPayload(authData: M2MAuthData) {
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

export const createPayload = (authData: AuthData) =>
  match(authData)
    .with({ systemRole: "maintenance" }, () => createMaintenancePayload())
    .with({ systemRole: "m2m" }, (data: M2MAuthData) => createM2MPayload(data))
    .with({ systemRole: "internal" }, () => createInternalPayload())
    .with({ systemRole: undefined }, (data: UIAuthData) =>
      createUserPayload(data)
    )
    .exhaustive();
