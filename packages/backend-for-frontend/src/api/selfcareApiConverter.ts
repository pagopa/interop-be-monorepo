import { selfcareV2ClientApi, bffApi } from "pagopa-interop-api-clients";
import { match, P } from "ts-pattern";
import { selfcareEntityNotFilled } from "../model/errors.js";

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

/**
 * 
      id: z.string().optional(),
    institutionDescription: z.string().optional(),
    institutionId: z.string().optional(),
    institutionRootName: z.string().optional(),
    products: z.array(UserProductResource).optional(),
    userId: z.string(),
 
 
    id: z.string().uuid(),
    description: z.string(),
    userProductRoles: z.array(z.string()),
    parent: z.string().optional(),
 
 */

export const toApiSelfcareInstitution = (
  input: selfcareV2ClientApi.UserInstitutionResource
): bffApi.SelfcareInstitution =>
  match(input)
    .with(
      {
        id: P.nonNullable,
        institutionDescription: P.nonNullable,
        products: P.nonNullable,
      },
      (institution) => ({
        id: institution.userId,
        description: institution.institutionDescription,
        userProductRoles: institution.products.flatMap((product) =>
          product.role ? [product.role] : []
        ),
      })
    )
    .with({ id: P.nullish }, () => {
      throw selfcareEntityNotFilled("UserInstitutionResource", "id");
    })
    .with({ institutionDescription: P.nullish }, () => {
      throw selfcareEntityNotFilled(
        "UserInstitutionResource",
        "institutionDescription"
      );
    })
    .with({ products: P.nullish }, () => {
      throw selfcareEntityNotFilled("UserInstitutionResource", "products");
    })
    .otherwise(() => {
      throw selfcareEntityNotFilled("UserInstitutionResource", "unknown");
    });

export const toApiSelfcareProduct = (
  input: selfcareV2ClientApi.ProductResource
): bffApi.SelfcareProduct => ({
  id: input.id,
  name: input.title,
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
