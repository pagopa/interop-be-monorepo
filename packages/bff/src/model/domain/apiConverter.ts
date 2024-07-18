import {
  InstitutionResource,
  ProductResource,
  UserResource,
} from "pagopa-interop-selfcare-v2-client";
import { P, match } from "ts-pattern";
import { bffApi } from "pagopa-interop-api-clients";
import { selfcareEntityNotFilled } from "./errors.js";

export const toApiSelfcareInstitution = (
  input: InstitutionResource
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
  input: ProductResource
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
  input: UserResource,
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
