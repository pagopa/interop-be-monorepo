import { isAxiosError } from "axios";
import { bffApi, contactDataApi, tenantApi } from "pagopa-interop-api-clients";
import { logger, RefreshableInteropToken } from "pagopa-interop-commons";
import { CorrelationId } from "pagopa-interop-models";

import { getLatestTenantContactEmail } from "../model/modelMappingUtils.js";

export function tenantContactServiceBuilder(
  client: Pick<
    contactDataApi.ContactDataManagerClient,
    "createContact" | "getContact"
  >,
  token: Pick<RefreshableInteropToken, "get">
) {
  async function internalHeaders(correlationId: CorrelationId) {
    const { serialized } = await token.get();
    return {
      Authorization: `Bearer ${serialized}`,
      "X-Correlation-Id": correlationId,
    };
  }

  return {
    async create(
      address: string,
      correlationId: CorrelationId
    ): Promise<string> {
      const { id } = await client.createContact(
        { email: address },
        {
          headers: await internalHeaders(correlationId),
        }
      );
      return id;
    },

    async resolve(
      tenant: tenantApi.Tenant,
      correlationId: CorrelationId
    ): Promise<bffApi.Mail | undefined> {
      if (!tenant.contactId) {
        return getLatestTenantContactEmail(tenant);
      }
      const headers = await internalHeaders(correlationId);
      try {
        const { email } = await client.getContact({
          params: { contactId: tenant.contactId },
          headers,
        });
        return { address: email };
      } catch (error) {
        if (!isAxiosError(error)) {
          throw error;
        }
        const status = error.response?.status;
        if (status !== undefined && status !== 404 && status < 500) {
          throw error;
        }
        logger({ correlationId }).warn(
          `Unable to resolve contact ${tenant.contactId} for tenant ${tenant.id}: ${status ?? error.code ?? "no response"}`
        );
        return undefined;
      }
    },
  };
}

export type TenantContactService = ReturnType<
  typeof tenantContactServiceBuilder
>;
