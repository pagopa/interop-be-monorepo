import {
  InstitutionResource,
  ProductResource,
  UserResource,
} from "pagopa-interop-selfcare-v2-client";
import { P, match } from "ts-pattern";
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
