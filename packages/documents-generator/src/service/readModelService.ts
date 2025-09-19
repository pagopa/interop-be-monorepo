import {
  AttributeCollection,
  DelegationCollection,
  ReadModelFilter,
  ReadModelRepository,
} from "pagopa-interop-commons";
import {
  Agreement,
  agreementState,
  Attribute,
  AttributeId,
  AttributeReadmodel,
  Delegation,
  DelegationId,
  delegationKind,
  DelegationReadModel,
  delegationState,
  EService,
  EServiceId,
  genericInternalError,
  Tenant,
  TenantId,
  WithMetadata,
} from "pagopa-interop-models";
import { Filter } from "mongodb";
import { z } from "zod";

async function getAttribute(
  attributes: AttributeCollection,
  filter: Filter<{ data: AttributeReadmodel }>
): Promise<Attribute | undefined> {
  const data = await attributes.findOne(filter, {
    projection: { data: true },
  });
  if (data) {
    const result = Attribute.safeParse(data.data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse attribute item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
  return undefined;
}

async function getDelegation(
  delegations: DelegationCollection,
  filter: Filter<{ data: DelegationReadModel }>
): Promise<Delegation | undefined> {
  const data = await delegations.findOne(filter, {
    projection: { data: true },
  });
  if (data) {
    const result = Delegation.safeParse(data.data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse delegation item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { eservices, tenants, agreements, attributes, delegations } =
    readModelRepository;

  return {
    async getEServiceById(
      id: EServiceId
    ): Promise<WithMetadata<EService> | undefined> {
      const data = await eservices.findOne(
        { "data.id": id },
        {
          projection: { data: true, metadata: true },
        }
      );
      if (!data) {
        return undefined;
      } else {
        const result = z
          .object({
            metadata: z.object({ version: z.number() }),
            data: EService,
          })
          .safeParse(data);
        if (!result.success) {
          throw genericInternalError(
            `Unable to parse eService item: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(data)} `
          );
        }
        return {
          data: result.data.data,
          metadata: { version: result.data.metadata.version },
        };
      }
    },
    async getTenantById(tenantId: string): Promise<Tenant | undefined> {
      const data = await tenants.findOne(
        { "data.id": tenantId },
        { projection: { data: true } }
      );

      if (data) {
        const result = Tenant.safeParse(data.data);

        if (!result.success) {
          throw genericInternalError(
            `Unable to parse tenant item: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(data)} `
          );
        }

        return result.data;
      }
      return undefined;
    },
    async getDelegationRelatedAgreement(
      eserviceId: EServiceId,
      consumerId: TenantId
    ): Promise<Agreement | null> {
      const data = await agreements.findOne({
        "data.eserviceId": eserviceId,
        "data.consumerId": consumerId,
        "data.state": {
          $in: [
            agreementState.active,
            agreementState.suspended,
            agreementState.pending,
          ],
        },
      });

      if (!data) {
        return null;
      }

      const result = Agreement.safeParse(data.data);
      if (!result.success) {
        throw genericInternalError(
          `Unable to parse agreement: ${JSON.stringify(result)}`
        );
      }

      return result.data;
    },

    async getAttributeById(id: AttributeId): Promise<Attribute | undefined> {
      return getAttribute(attributes, { "data.id": id });
    },
    async getActiveProducerDelegationByEserviceId(
      eserviceId: EServiceId
    ): Promise<Delegation | undefined> {
      return getDelegation(delegations, {
        "data.eserviceId": eserviceId,
        "data.state": delegationState.active,
        "data.kind": delegationKind.delegatedProducer,
      });
    },
    async getActiveConsumerDelegationByAgreement(
      agreement: Pick<Agreement, "consumerId" | "eserviceId">
    ): Promise<Delegation | undefined> {
      return getDelegation(delegations, {
        "data.eserviceId": agreement.eserviceId,
        "data.delegatorId": agreement.consumerId,
        "data.state": delegationState.active,
        "data.kind": delegationKind.delegatedConsumer,
      });
    },
    async getActiveConsumerDelegationByDelegationId(
      delegationId: DelegationId
    ): Promise<Delegation | undefined> {
      return getDelegation(delegations, {
        "data.id": delegationId,
        "data.state": delegationState.active,
        "data.kind": delegationKind.delegatedConsumer,
      } satisfies ReadModelFilter<Delegation>);
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
