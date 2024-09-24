/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { TenantId, UserId } from "pagopa-interop-models";
import {
  bffApi,
  selfcareV2ClientApi,
  SelfcareV2InstitutionClient,
} from "pagopa-interop-api-clients";
import { WithLogger, Logger } from "pagopa-interop-commons";
import { missingSelfcareId, userNotFound } from "../model/errors.js";
import { TenantProcessClient } from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";
import {
  toApiSelfcareInstitution,
  toApiSelfcareProduct,
  toApiSelfcareUser,
} from "../api/selfcareApiConverter.js";

export function selfcareServiceBuilder(
  selfcareV2Client: SelfcareV2InstitutionClient,
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
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.User> {
      const institutionId = ctx.authData.selfcareId;
      const userId = ctx.authData.userId;
      ctx.logger.info(
        `Retrieving User with with istitution id ${institutionId}, user ${userId}`
      );

      const users = await selfcareV2Client.getInstitutionProductUsersUsingGET({
        params: { institutionId },
        queries: {
          userIdForAuth: userId,
          userId: userIdQuery,
        },
      });

      const user = users.at(0);
      if (!user) {
        throw userNotFound(userIdQuery, institutionId);
      }
      return toApiSelfcareUser(user, ctx.authData.organizationId);
    },

    async getSelfcareInstitutionsProducts(
      userId: UserId,
      institutionId: string,
      logger: Logger
    ): Promise<bffApi.SelfcareProduct[]> {
      logger.info(
        `Retrieving Products for Institution ${institutionId} and User ${userId}`
      );
      const products =
        await selfcareV2Client.getInstitutionUserProductsUsingGET({
          params: { institutionId },
          queries: { userId },
        });

      return products.map(toApiSelfcareProduct);
    },

    async getSelfcareInstitutions(
      userId: UserId,
      logger: Logger
    ): Promise<bffApi.SelfcareInstitution[]> {
      logger.info(`Retrieving Institutions for User ${userId}`);

      const institutions = await selfcareV2Client.getInstitutionsUsingGET({
        queries: { userIdForAuth: userId },
      });

      return institutions.map(toApiSelfcareInstitution);
    },

    async getInstitutionUsers(
      tenantId: TenantId,
      userId: string | undefined,
      roles: string[],
      query: string | undefined,
      { authData, logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.Users> {
      logger.info(`Retrieving users for institutions ${tenantId}`);

      const requesterId = authData.organizationId;
      const tenant = await tenantProcessClient.tenant.getTenant({
        params: { id: tenantId },
        headers,
      });

      if (!tenant.selfcareId) {
        throw missingSelfcareId(tenantId);
      }

      const selfcareId = tenant.selfcareId;
      const users: selfcareV2ClientApi.UserResource[] =
        await selfcareV2Client.getInstitutionProductUsersUsingGET({
          params: { institutionId: selfcareId },
          queries: {
            userId,
            userIdForAuth: requesterId,
            productRoles: roles,
          },
        });

      return filterByUserNameOfSurname(users, query).map((user) =>
        toApiSelfcareUser(user, tenantId)
      );
    },
  };
}

export type SelfcareService = ReturnType<typeof selfcareServiceBuilder>;
