import { createHash } from "crypto";
import {
  InstitutionResource,
  ProductResource,
  UserResource,
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
} from "../api/bffTypes.js";
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
  input: ProductResource
): BffApiSelfcareProduct =>
  match(input)
    .with({ id: P.not(P.nullish), title: P.not(P.nullish) }, (product) => ({
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
  seed: BffApiAttributeSeed
): AttributeProcessApiAttributeSeed => ({
  ...seed,
  code: createHash("sha256").update(seed.name).digest("hex"),
});
