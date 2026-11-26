import { AxiosError, isAxiosError } from "axios";
import { bffApi, tenantApi } from "pagopa-interop-api-clients";
import { logger } from "pagopa-interop-commons";
import { TenantId } from "pagopa-interop-models";

import { TenantProcessClient } from "../clients/clientsProvider.js";
import { Headers } from "../utilities/context.js";

// Zodios diagnostics can contain the request or response body, including the address.
export function tenantContactRequestError(error: unknown): Error {
  const message = "Tenant contact request failed";
  return isAxiosError(error) && error.response
    ? new AxiosError(message, undefined, undefined, undefined, error.response)
    : new Error(message);
}

export function tenantContactServiceBuilder(
  client: Pick<TenantProcessClient["tenant"], "getTenantContact">
) {
  return {
    async resolve(
      tenant: Pick<tenantApi.Tenant, "id">,
      organizationId: TenantId,
      headers: Headers
    ): Promise<bffApi.Mail | undefined> {
      if (tenant.id !== organizationId) {
        return undefined;
      }
      try {
        return await client.getTenantContact({
          params: { tenantId: tenant.id },
          headers,
        });
      } catch (error) {
        if (!isAxiosError(error)) {
          throw tenantContactRequestError(error);
        }
        const status = error.response?.status;
        if (status !== undefined && status !== 404 && status < 500) {
          throw tenantContactRequestError(error);
        }
        logger({ correlationId: headers["X-Correlation-Id"] }).warn(
          `Unable to resolve contact for tenant ${tenant.id}: ${status ?? "no response"}`
        );
        return undefined;
      }
    },
  };
}

export type TenantContactService = ReturnType<
  typeof tenantContactServiceBuilder
>;
