import { createHash } from "crypto";
import {
  InstitutionResource,
  ProductResource,
  UserResource,
  UserResponse,
} from "pagopa-interop-selfcare-v2-client";
import { match, P } from "ts-pattern";
import { AttributeProcessApiAttributeSeed } from "../api/attributeTypes.js";
import {
  BffApiSelfcareInstitution,
  BffApiSelfcareProduct,
  BffApiSelfcareUser,
  BffApiAttributeSeed,
  BffApiCompactClient,
  BffApiCompactUser,
} from "../api/bffTypes.js";
import { AuthProcessApiClientWithKeys } from "../api/clientTypes.js";
import { selfcareEntityNotFilled } from "./errors.js";
import { PrivacyNoticeKind } from "./types.js";

export const toBffApiSelfcareInstitution = (
  input: InstitutionResource
): BffApiSelfcareInstitution =>
  match(input)
    .with(
      {
        id: P.not(P.nullish),
        description: P.not(P.nullish),
        userProductRoles: P.not(P.nullish),
      },
      (institution) => ({
        id: institution.id,
        description: institution.description,
        userProductRoles: institution.userProductRoles,
      })
    )
    .otherwise(() => {
      throw selfcareEntityNotFilled("InstitutionResource");
    });

export const toBffApiSelfcareProduct = (
  input: ProductResource
): BffApiSelfcareProduct =>
  match(input)
    .with({ id: P.not(P.nullish), title: P.not(P.nullish) }, (product) => ({
      id: product.id,
      name: product.title,
    }))
    .otherwise(() => {
      throw selfcareEntityNotFilled("ProductResource");
    });

export const toBffApiSelfcareUser = (
  input: UserResource,
  tenantId: string
): BffApiSelfcareUser =>
  match(input)
    .with(
      {
        id: P.not(P.nullish),
        name: P.not(P.nullish),
        surname: P.not(P.nullish),
        roles: P.not(P.nullish),
      },
      (user) => ({
        userId: user.id,
        name: user.name,
        familyName: user.surname,
        roles: user.roles,
        tenantId,
      })
    )
    .otherwise(() => {
      throw selfcareEntityNotFilled("UserResource");
    });

export const toProcessAttributeSeed = (
  seed: BffApiAttributeSeed
): AttributeProcessApiAttributeSeed => ({
  ...seed,
  code: createHash("sha256").update(seed.name).digest("hex"),
});

export const toBffApiCompactClient = (
  input: AuthProcessApiClientWithKeys
): BffApiCompactClient => ({
  hasKeys: input.keys.length > 0,
  id: input.client.id,
  name: input.client.name,
});

export const toBffApiCompactUser = (
  input: UserResponse,
  userId: string
): BffApiCompactUser =>
  match(input)
    .with({ name: P.nullish, surname: P.nullish }, () => ({
      userId,
      name: "Utente",
      familyName: userId,
    }))
    .otherwise((ur) => ({
      userId,
      name: ur.name ?? "",
      familyName: ur.surname ?? "",
    }));

export const fromApiConsentType = (type: "TOS" | "PP"): PrivacyNoticeKind =>
  match(type)
    .with("TOS", () => PrivacyNoticeKind.TOS)
    .with("PP", () => PrivacyNoticeKind.PP)
    .exhaustive();
