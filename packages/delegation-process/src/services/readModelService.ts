import {
  DelegationCollection,
  ReadModelRepository,
} from "pagopa-interop-commons";
import {
  Delegation,
  DelegationId,
  DelegationReadModel,
  WithMetadata,
  genericInternalError,
} from "pagopa-interop-models";
import { Filter, WithId } from "mongodb";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const delegations = readModelRepository.delegations;

  return {
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
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
