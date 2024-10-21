/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DelegationId } from "pagopa-interop-models";
import { WithLogger } from "pagopa-interop-commons";
import {
  bffApi,
  catalogApi,
  delegationApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import {
  CatalogProcessClient,
  DelegationProcessClient,
  TenantProcessClient,
} from "../clients/clientsProvider.js";
import { BffAppContext, Headers } from "../utilities/context.js";
import { toBffDelegationApiDelegation } from "../api/delegationApiConverter.js";

async function enhanceDelegation(
  delegationClient: DelegationProcessClient,
  tenantClient: TenantProcessClient,
  catalogClient: CatalogProcessClient,
  delegationId: DelegationId,
  headers: Headers
): Promise<bffApi.Delegation> {
  const delegation: delegationApi.Delegation =
    await delegationClient.delegation.getDelegation({
      params: { delegationId },
    });

  const delegator: tenantApi.Tenant = await tenantClient.tenant.getTenant({
    params: { id: delegation.delegatorId },
    headers,
  });

  const delegate: tenantApi.Tenant = await tenantClient.tenant.getTenant({
    params: { id: delegation.delegateId },
    headers,
  });

  const eservice: catalogApi.EService = await catalogClient.getEServiceById({
    params: { eServiceId: delegation.eserviceId },
    headers,
  });

  return toBffDelegationApiDelegation(
    delegation,
    delegator,
    delegate,
    eservice
  );
}

export function delegationServiceBuilder(
  delegationClient: DelegationProcessClient,
  tenantClient: TenantProcessClient,
  catalogClient: CatalogProcessClient
) {
  return {
    async getDelegationById(
      delegationId: DelegationId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.Delegation> {
      logger.info(`Retrieving delegation with id ${delegationId}`);

      return enhanceDelegation(
        delegationClient,
        tenantClient,
        catalogClient,
        delegationId,
        headers
      );
    },
  };
}
