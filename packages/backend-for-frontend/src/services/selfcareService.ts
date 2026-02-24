/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { CorrelationId, TenantId } from "pagopa-interop-models";
import {
  bffApi,
  selfcareV2ClientApi,
  SelfcareV2UsersClient,
} from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { missingSelfcareId, userNotFound } from "../model/errors.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";
import {
  toApiSelfcareInstitution,
  toApiSelfcareProduct,
  toApiSelfcareUser,
  toBffApiCompactUser,
} from "../api/selfcareApiConverter.js";
import { config } from "../config/config.js";
import { assertRequesterCanRetrieveUsers } from "./validators.js";

export async function getSelfcareCompactUserById(
  selfcareClient: SelfcareV2UsersClient,
  userId: string,
  selfcareId: string,
  correlationId: CorrelationId
): Promise<bffApi.CompactUser> {
  const user = await selfcareClient.getUserInfoUsingGET({
    params: { id: userId },
    queries: { institutionId: selfcareId },
    headers: {
      "X-Correlation-Id": correlationId,
    },
  });

  return toBffApiCompactUser(user, userId);
}

export function selfcareServiceBuilder({
  tenantProcessClient,
  selfcareV2InstitutionClient,
  selfcareV2UserClient,
}: PagoPAInteropBeClients) {
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
        `Retrieving User with institution id ${institutionId}, user ${userId}`
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
      authData: { userId },
      logger,
      correlationId,
    }: WithLogger<BffAppContext>): Promise<bffApi.SelfcareInstitution[]> {
      logger.info(`Retrieving Institutions for User ${userId}`);

      const institutions = await selfcareV2UserClient.v2getUserInstitution({
        queries: {
          userId,
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
      { logger, correlationId, headers, authData }: WithLogger<BffAppContext>
    ): Promise<bffApi.Users> {
      logger.info(`Retrieving users for institutions ${tenantId}`);

      assertRequesterCanRetrieveUsers(authData.organizationId, tenantId);

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
