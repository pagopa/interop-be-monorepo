import { M2MAdminAuthData, WithLogger } from "pagopa-interop-commons";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { toM2MGatewayApiUser } from "../api/usersApiConverter.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { assertTenantHasSelfcareId } from "../utils/validators/tenantValidators.js";

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

      // Get tenant to resolve institutionId (selfcareId)
      const { data: tenant } =
        await clients.tenantProcessClient.tenant.getTenant({
          params: { id: authData.organizationId },
          headers,
        });

      assertTenantHasSelfcareId(tenant);

      // Fetch users from SelfCare (API already returns only active users)
      const { data: users } =
        await clients.selfcareV2Client.getInstitutionUsersByProductUsingGET({
          params: { institutionId: tenant.selfcareId },
          queries: {
            productRoles: roles.length > 0 ? roles.join(",") : undefined,
          },
          headers,
        });

      // Apply pagination (in-memory since SelfCare doesn't support pagination)
      const paginatedUsers = users.slice(offset, offset + limit);

      // Map to API response
      const results: m2mGatewayApiV3.User[] =
        paginatedUsers.map(toM2MGatewayApiUser);

      return {
        results,
        pagination: {
          limit,
          offset,
          totalCount: users.length,
        },
      };
    },
  };
}
