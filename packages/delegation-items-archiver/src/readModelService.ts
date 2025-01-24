import { ReadModelFilter, ReadModelRepository } from "pagopa-interop-commons";
import {
  DelegationId,
  Purpose,
  PurposeVersionState,
} from "pagopa-interop-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { purposes } = readModelRepository;

  return {
    async getPurposes(delegationId: DelegationId): Promise<Purpose[]> {
      return await purposes
        .find({
          "data.delegationId": delegationId,
          "data.versions.state": {
            $in: [
              "Active",
              "Suspended",
              "Draft",
              "WaitingForApproval",
            ] satisfies PurposeVersionState[],
          },
        } satisfies ReadModelFilter<Purpose>)
        .map(({ data }) => Purpose.parse(data))
        .toArray();
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
