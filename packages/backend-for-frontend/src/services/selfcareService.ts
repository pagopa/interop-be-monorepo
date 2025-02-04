/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { TenantId } from "pagopa-interop-models";
import {
  bffApi,
  selfcareV2ClientApi,
  SelfcareV2InstitutionClient,
  SelfcareV2UsersClient,
} from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { missingSelfcareId, userNotFound } from "../model/errors.js";
import { TenantProcessClient } from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";
import {
  toApiSelfcareInstitution,
  toApiSelfcareProduct,
  toApiSelfcareUser,
} from "../api/selfcareApiConverter.js";
import { config } from "../config/config.js";

export function selfcareServiceBuilder(
  selfcareV2InstitutionClient: SelfcareV2InstitutionClient,
  selfcareV2UsersClient: SelfcareV2UsersClient,
  tenantProcessClient: TenantProcessClient
) {
  const filterByUserNameOfSurname = (
    users: selfcareV2ClientApi.UserResource[],
    query?: string
  ): selfcareV2ClientApi.UserResource[] =>
    !query
      ? users
      : users.filter(
          (user) =>
            user.name?.toLowerCase().includes(query.toLowerCase()) ||
            user.surname?.toLowerCase().includes(query.toLowerCase())
        );

  return {
    async getSelfcareUser(
      userIdQuery: string,
      {
        authData: { selfcareId: institutionId, userId, organizationId },
        logger,
        correlationId,
      }: WithLogger<BffAppContext>
    ): Promise<bffApi.User> {
      logger.info(
        `Retrieving User with with istitution id ${institutionId}, user ${userId}`
      );

      const users: selfcareV2ClientApi.UserResource[] =
        await selfcareV2InstitutionClient.getInstitutionUsersByProductUsingGET({
          params: { institutionId },
          queries: {
            userId: userIdQuery,
          },
          headers: {
            "X-Correlation-Id": correlationId,
          },
        });

      const user = users.at(0);
      if (!user) {
        throw userNotFound(userIdQuery, institutionId);
      }
      return toApiSelfcareUser(user, organizationId);
    },

    async getSelfcareInstitutionsProducts({
      authData: { selfcareId: institutionId, userId },
      logger,
      correlationId,
    }: WithLogger<BffAppContext>): Promise<bffApi.SelfcareProduct[]> {
      logger.info(
        `Retrieving Products for Institution ${institutionId} and User ${userId}`
      );
      const products =
        await selfcareV2InstitutionClient.getInstitutionProductsUsingGET({
          params: { institutionId },
          queries: { userId },
          headers: {
            "X-Correlation-Id": correlationId,
          },
        });

      return products.map(toApiSelfcareProduct);
    },

    async getSelfcareInstitutions({
      authData: { userId, selfcareId },
      logger,
      correlationId,
    }: WithLogger<BffAppContext>): Promise<bffApi.SelfcareInstitution[]> {
      logger.info(`Retrieving Institutions for User ${userId}`);

      const institutions = await selfcareV2UsersClient.v2getUserInstitution({
        queries: {
          userId,
          institutionId: selfcareId,
          states: "ACTIVE",
          products: config.selfcareProductName,
        },
        headers: {
          "X-Correlation-Id": correlationId,
        },
      });

      return institutions.map(toApiSelfcareInstitution);
    },

    async getInstitutionUsers(
      tenantId: TenantId,
      userId: string | undefined,
      roles: string[],
      query: string | undefined,
      { logger, correlationId, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.Users> {
      logger.info(`Retrieving users for institutions ${tenantId}`);

      const tenant = await tenantProcessClient.tenant.getTenant({
        params: { id: tenantId },
        headers,
      });

      if (!tenant.selfcareId) {
        throw missingSelfcareId(tenantId);
      }

      const selfcareId = tenant.selfcareId;
      const users: selfcareV2ClientApi.UserResource[] =
        await selfcareV2InstitutionClient.getInstitutionUsersByProductUsingGET({
          params: { institutionId: selfcareId },
          queries: {
            userId,
            productRoles: roles.join(","),
          },
          headers: {
            "X-Correlation-Id": correlationId,
          },
        });

      return filterByUserNameOfSurname(users, query).map((user) =>
        toApiSelfcareUser(user, tenantId)
      );
    },
  };
}

export type SelfcareService = ReturnType<typeof selfcareServiceBuilder>;
