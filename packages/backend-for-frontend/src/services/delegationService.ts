/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  bffApi,
  catalogApi,
  delegationApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { DelegationId } from "pagopa-interop-models";
import {
  toBffDelegationApiCompactDelegation,
  toBffDelegationApiDelegation,
} from "../api/delegationApiConverter.js";
import {
  CatalogProcessClient,
  DelegationProcessClient,
  TenantProcessClient,
} from "../clients/clientsProvider.js";
import { delegationNotFound } from "../model/errors.js";
import { BffAppContext, Headers } from "../utilities/context.js";

// eslint-disable-next-line max-params
async function enhanceDelegation<
  T extends bffApi.Delegation | bffApi.CompactDelegation
>(
  delegationClient: DelegationProcessClient,
  tenantClient: TenantProcessClient,
  catalogClient: CatalogProcessClient,
  delegationId: string,
  headers: Headers,
  toApiConverter: (
    delegation: delegationApi.Delegation,
    delegator: tenantApi.Tenant,
    delegate: tenantApi.Tenant,
    eservice: catalogApi.EService
  ) => T
): Promise<T> {
  const delegation: delegationApi.Delegation =
    await delegationClient.delegation.getDelegation({
      params: { delegationId },
      headers,
    });

  if (!delegation) {
    throw delegationNotFound(delegationId);
  }

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

  return toApiConverter(delegation, delegator, delegate, eservice);
}

export function delegationServiceBuilder(
  delegationClients: DelegationProcessClient,
  tenantClient: TenantProcessClient,
  catalogClient: CatalogProcessClient
) {
  return {
    async getDelegationById(
      delegationId: DelegationId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.Delegation> {
      logger.info(`Retrieving delegation with id ${delegationId}`);

      return enhanceDelegation<bffApi.Delegation>(
        delegationClients,
        tenantClient,
        catalogClient,
        delegationId,
        headers,
        toBffDelegationApiDelegation
      );
    },
    async getDelegations(
      {
        limit,
        offset,
        states,
        kind,
        delegatedIds,
        delegatorIds,
      }: {
        limit: number;
        offset: number;
        states?: bffApi.DelegationState[];
        kind?: bffApi.DelegationKind;
        delegatedIds?: string[];
        delegatorIds?: string[];
      },
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.CompactDelegations> {
      logger.info("Retrieving all delegations");

      const delegationsResults =
        await delegationClients.delegation.getDelegations({
          queries: {
            limit,
            offset,
            delegatorIds,
            delegateIds: delegatedIds,
            delegationStates: states,
            kind,
          },
          headers,
        });

      const delegationEnanched = await Promise.all(
        delegationsResults.results.map((delegation) =>
          enhanceDelegation<bffApi.CompactDelegation>(
            delegationClients,
            tenantClient,
            catalogClient,
            delegation.id,
            headers,
            toBffDelegationApiCompactDelegation
          )
        )
      );

      return {
        results: delegationEnanched,
        pagination: {
          limit,
          offset,
          totalCount: delegationsResults.totalCount,
        },
      };
    },
    async createDelegation(
      createDelegationBody: bffApi.DelegationSeed,
      { headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> {
      const delegation =
        await delegationClients.producer.createProducerDelegation(
          createDelegationBody,
          { headers }
        );

      return { id: delegation.id };
    },
    async delegatorRevokeDelegation(
      delegationId: DelegationId,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      return delegationClients.producer.revokeProducerDelegation(undefined, {
        params: {
          delegationId,
        },
        headers,
      });
    },
    async delegateRejectDelegation(
      delegationId: DelegationId,
      rejectBody: bffApi.RejectDelegationPayload,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      return delegationClients.producer.rejectProducerDelegation(rejectBody, {
        params: {
          delegationId,
        },
        headers,
      });
    },
    async delegateApproveDelegation(
      delegationId: DelegationId,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      return delegationClients.producer.approveProducerDelegation(undefined, {
        params: {
          delegationId,
        },
        headers,
      });
    },
  };
}