/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { TenantId, UserId } from "pagopa-interop-models";
import {
  bffApi,
  selfcareV2ClientApi,
  SelfcareV2InstitutionClient,
} from "pagopa-interop-api-clients";
import { WithLogger, Logger } from "pagopa-interop-commons";
import {
  missingSelfcareId,
  missingUserId,
  userNotFound,
} from "../model/errors.js";
import { TenantProcessClient } from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";
import { toApiSelfcareUser } from "../api/selfcareApiConverter.js";

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
      userId: UserId,
      userIdQuery: string,
      institutionId: string,
      logger: Logger
    ): Promise<selfcareV2ClientApi.UserResource> {
      logger.info(
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
      return user;
    },

    async getSelfcareInstitutionsProducts(
      userId: UserId,
      institutionId: string,
      logger: Logger
    ): Promise<selfcareV2ClientApi.ProductResource[]> {
      logger.info(
        `Retrieving Products for Institution ${institutionId} and User ${userId}`
      );
      return selfcareV2Client.getInstitutionUserProductsUsingGET({
        params: { institutionId },
        queries: { userId },
      });
    },

    async getSelfcareInstitutions(
      userId: UserId,
      logger: Logger
    ): Promise<selfcareV2ClientApi.InstitutionResource[]> {
      logger.info(`Retrieving Institutions for User ${userId}`);
      return selfcareV2Client.getInstitutionsUsingGET({
        queries: { userIdForAuth: userId },
      });
    },

    async getInstitutionUsers(
      tenantId: TenantId,
      userId: UserId | undefined,
      query: string | undefined,
      { authData, logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.Users> {
      logger.info(`Retrieving users for institutions ${tenantId}`);

      const roles = authData.userRoles;
      const requesterId = authData.organizationId;
      if (!userId) {
        throw missingUserId();
      }

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
