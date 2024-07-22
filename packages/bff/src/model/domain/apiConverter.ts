import { createHash } from "crypto";
import {
  bffApi,
  attributeRegistryApi,
  selfcareV2ClientApi,
  authorizationApi,
} from "pagopa-interop-api-clients";
import { P, match } from "ts-pattern";
import { selfcareEntityNotFilled } from "./errors.js";
import { PrivacyNoticeKind } from "./types.js";

export const toApiSelfcareInstitution = (
  input: selfcareV2ClientApi.InstitutionResource
): bffApi.SelfcareInstitution =>
  match(input)
    .with(
      {
        id: P.nonNullable,
        description: P.nonNullable,
        userProductRoles: P.nonNullable,
      },
      (institution) => ({
        id: institution.id,
        description: institution.description,
        userProductRoles: institution.userProductRoles,
      })
    )
    .with({ id: P.nullish }, () => {
      throw selfcareEntityNotFilled("InstitutionResource", "id");
    })
    .with({ description: P.nullish }, () => {
      throw selfcareEntityNotFilled("InstitutionResource", "description");
    })
    .with({ userProductRoles: P.nullish }, () => {
      throw selfcareEntityNotFilled("InstitutionResource", "userProductRoles");
    })
    .otherwise(() => {
      throw selfcareEntityNotFilled("InstitutionResource", "unkown");
    });

export const toApiSelfcareProduct = (
  input: selfcareV2ClientApi.ProductResource
): bffApi.SelfcareProduct =>
  match(input)
    .with({ id: P.nonNullable, title: P.nonNullable }, (product) => ({
      id: product.id,
      name: product.title,
    }))
    .with({ id: P.nullish }, () => {
      throw selfcareEntityNotFilled("ProductResource", "id");
    })
    .with({ title: P.nullish }, () => {
      throw selfcareEntityNotFilled("ProductResource", "title");
    })
    .otherwise(() => {
      throw selfcareEntityNotFilled("ProductResource", "unknown");
    });

export const toApiSelfcareUser = (
  input: selfcareV2ClientApi.UserResource,
  tenantId: string
): bffApi.User =>
  match(input)
    .with(
      {
        id: P.nonNullable,
        name: P.nonNullable,
        surname: P.nonNullable,
        roles: P.nonNullable,
      },
      (user) => ({
        userId: user.id,
        name: user.name,
        familyName: user.surname,
        roles: user.roles,
        tenantId,
      })
    )
    .with({ id: P.nullish }, () => {
      throw selfcareEntityNotFilled("UserResource", "id");
    })
    .with({ name: P.nullish }, () => {
      throw selfcareEntityNotFilled("UserResource", "name");
    })
    .with({ surname: P.nullish }, () => {
      throw selfcareEntityNotFilled("UserResource", "surname");
    })
    .with({ roles: P.nullish }, () => {
      throw selfcareEntityNotFilled("UserResource", "roles");
    })
    .otherwise(() => {
      throw selfcareEntityNotFilled("UserResource", "unknown");
    });

export const toApiAttributeProcessSeed = (
  seed: bffApi.AttributeSeed
): attributeRegistryApi.CertifiedAttributeSeed => ({
  ...seed,
  code: createHash("sha256").update(seed.name).digest("hex"),
});

export const toBffApiCompactClient = (
  input: authorizationApi.ClientWithKeys
): bffApi.CompactClient => ({
  hasKeys: input.keys.length > 0,
  id: input.client.id,
  name: input.client.name,
});

export const toBffApiCompactUser = (
  input: selfcareV2ClientApi.UserResponse,
  userId: string
): bffApi.CompactUser =>
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
