import { createHash } from "crypto";
import {
  InstitutionResource,
  ProductResource,
  UserResource,
  UserResponse,
} from "pagopa-interop-selfcare-v2-client";
import { P, match } from "ts-pattern";
import {
  BffApiAttributeSeed,
  AttributeProcessApiAttributeSeed,
} from "../api/attributeTypes.js";
import {
  ApiSelfcareInstitution,
  BffApiSelfcareProduct,
  BffApiSelfcareUser,
} from "../api/selfcareTypes.js";
import {
  AuthProcessApiClientWithKeys,
  BffApiCompactClient,
  BffApiCompactUser,
} from "../api/clientTypes.js";
import { selfcareEntityNotFilled } from "./errors.js";

export const toApiSelfcareInstitution = (
  input: InstitutionResource
): ApiSelfcareInstitution =>
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

export const toApiSelfcareProduct = (
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

export const toApiSelfcareUser = (
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

export const toApiAttributeProcessSeed = (
  seed: BffApiAttributeSeed
): AttributeProcessApiAttributeSeed => ({
  ...seed,
  code: createHash("sha256").update(seed.name).digest("hex"),
});

export const toApiCompactClient = (
  input: AuthProcessApiClientWithKeys
): BffApiCompactClient => ({
  hasKeys: input.keys.length > 0,
  id: input.client.id,
  name: input.client.name,
});

export const toApiCompactUser = (
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
