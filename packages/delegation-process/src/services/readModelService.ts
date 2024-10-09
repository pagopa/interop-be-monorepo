import {
  DelegationCollection,
  EServiceCollection,
  ReadModelRepository,
} from "pagopa-interop-commons";
import {
  Delegation,
  DelegationId,
  EService,
  EServiceId,
  EServiceReadModel,
  DelegationReadModel,
  WithMetadata,
  genericInternalError,
} from "pagopa-interop-models";
import { Filter, WithId } from "mongodb";
import { z } from "zod";
import { GetDelegationsFilters } from "../model/domain/models.js";

const toReadModelFilter = (
  filters: GetDelegationsFilters
): Filter<WithId<WithMetadata<DelegationReadModel>>> => {
  const { delegateId, delegatorId, eserviceId, delegationKind } = filters;

  const delegatorIdFilter = delegatorId
    ? {
        "data.delegatorId": { $eq: delegatorId },
      }
    : {};
  const delegateIdFilter = delegateId
    ? {
        "data.delegateId": { $eq: delegateId },
      }
    : {};
  const eserviceIdFilter = eserviceId
    ? {
        "data.eserviceId": { $eq: eserviceId },
      }
    : {};
  const delegationKindFilter = delegationKind
    ? {
        "data.kind": { $eq: delegationKind },
      }
    : {};

  return {
    ...delegatorIdFilter,
    ...delegateIdFilter,
    ...eserviceIdFilter,
    ...delegationKindFilter,
  };
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const delegations = readModelRepository.delegations;
  const eservices = readModelRepository.eservices;
  return {
    async getEService(
      eservices: EServiceCollection,
      filter: Filter<WithId<WithMetadata<EServiceReadModel>>>
    ): Promise<WithMetadata<EService> | undefined> {
      const data = await eservices.findOne(filter, {
        projection: { data: true, metadata: true },
      });
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
    async getDelegation(
      delegations: DelegationCollection,
      filter: Filter<WithId<WithMetadata<DelegationReadModel>>>
    ): Promise<Delegation | undefined> {
      const data = await delegations.findOne(filter, {
        projection: { data: true, metadata: true },
      });
      if (!data) {
        return undefined;
      }
      const result = Delegation.safeParse(data.data);
      if (!result.success) {
        throw genericInternalError(
          `Unable to parse delegation item: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }
      return result.data;
    },
    async getDelegationById(id: DelegationId): Promise<Delegation | undefined> {
      return this.getDelegation(delegations, { "data.id": id });
    },
    async findDelegation(
      filters: GetDelegationsFilters
    ): Promise<Delegation | undefined> {
      return this.getDelegation(delegations, toReadModelFilter(filters));
    },
    async getEServiceById(
      id: EServiceId
    ): Promise<WithMetadata<EService> | undefined> {
      return this.getEService(eservices, { "data.id": id });
    },
    async createDelegation(delegation: Delegation): Promise<void> {
      await delegations.insertOne({
        data: delegation,
        metadata: { version: 0 },
      });
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
