import { M2MAdminAuthData, WithLogger } from "pagopa-interop-commons";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  TenantId,
  unsafeBrandId,
  unauthorizedError,
  UserId,
} from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";

export type GetUsersQueryParams = {
  roles: string[];
  limit: number;
  offset: number;
};

export type UserService = ReturnType<typeof userServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function userServiceBuilder(clients: PagoPAInteropBeClients) {
  return {
    async getUsers(
      queryParams: GetUsersQueryParams,
      {
        logger,
        headers,
        authData,
      }: WithLogger<M2MGatewayAppContext<M2MAdminAuthData>>
    ): Promise<m2mGatewayApiV3.Users> {
      const { roles, limit, offset } = queryParams;

      logger.info(
        `Retrieving users for organization ${
          authData.organizationId
        } with roles ${roles.join(",")}, limit ${limit}, offset ${offset}`
      );

      // Resolve tenantId from organizationId
      const tenantId = unsafeBrandId<TenantId>(authData.organizationId);

      // Validate requester can only access their own organization's users
      if (authData.organizationId !== tenantId) {
        throw unauthorizedError(
          `Requester ${authData.organizationId} cannot retrieve users for a different organization`
        );
      }

      // Get tenant to resolve institutionId (selfcareId)
      const { data: tenant } =
        await clients.tenantProcessClient.tenant.getTenant({
          params: { id: tenantId },
          headers,
        });

      if (!tenant.selfcareId) {
        throw unauthorizedError(
          `Tenant ${tenantId} does not have a SelfCare ID`
        );
      }

      const selfcareId = tenant.selfcareId;

      // Fetch users from SelfCare (API already returns only active users)
      const { data: users } =
        await clients.selfcareV2Client.getInstitutionUsersByProductUsingGET({
          params: { institutionId: selfcareId },
          queries: {
            productRoles: roles.length > 0 ? roles.join(",") : undefined,
          },
          headers,
        });

      // Apply pagination (in-memory since SelfCare doesn't support pagination)
      const paginatedUsers = users.slice(offset, offset + limit);

      // Map to API response
      const results: m2mGatewayApiV3.User[] = paginatedUsers.map((user) => ({
        id: user.id,
        firstName: user.name,
        lastName: user.surname,
      }));

      return {
        results,
        pagination: {
          limit,
          offset,
          totalCount: users.length,
        },
      };
    },
    async getUser(
      userId: string,
      {
        logger,
        headers,
        authData,
      }: WithLogger<M2MGatewayAppContext<M2MAdminAuthData>>
    ): Promise<m2mGatewayApiV3.User> {
      logger.info(
        `Retrieving users for organization ${authData.organizationId} with userId ${userId}`
      );

      // Resolve tenantId from organizationId
      const tenantId = unsafeBrandId<TenantId>(authData.organizationId);
      const userIdBranded = unsafeBrandId<UserId>(userId);

      // Validate requester can only access their own organization's users
      if (authData.organizationId !== tenantId) {
        throw unauthorizedError(
          `Requester ${authData.organizationId} cannot retrieve users for a different organization`
        );
      }

      const { data: tenant } =
        await clients.tenantProcessClient.tenant.getTenant({
          params: { id: tenantId },
          headers,
        });

      if (!tenant.selfcareId) {
        throw unauthorizedError(
          `Tenant ${tenantId} does not have a SelfCare ID`
        );
      }

      const selfcareId = tenant.selfcareId;

      // Fetch users from SelfCare (API already returns only active users)
      const { data: users } =
        await clients.selfcareV2Client.getInstitutionUsersByProductUsingGET({
          params: { institutionId: selfcareId },
          queries: {
            userId: userIdBranded,
          },
          headers,
        });

      if (users.length === 0) {
        throw Error(`User ${userIdBranded} not found`);
      }

      if (users.length > 1) {
        throw Error(`Multiple users found for userId ${userIdBranded}`);
      }

      const user = users[0];

      const results: m2mGatewayApiV3.User = {
        id: user.id,
        firstName: user.name,
        lastName: user.surname,
      };

      return results;
    },
  };
}
