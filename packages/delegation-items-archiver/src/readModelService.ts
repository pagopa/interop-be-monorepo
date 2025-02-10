import { ReadModelFilter, ReadModelRepository } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementState,
  DelegationId,
  DelegationV2,
  Purpose,
  PurposeVersionState,
} from "pagopa-interop-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { purposes, agreements } = readModelRepository;

  return {
    async getPurposes(delegationId: DelegationId): Promise<Purpose[]> {
      return await purposes
        .find(
          {
            "data.delegationId": delegationId,
            "data.versions.state": {
              $in: [
                "Active",
                "Suspended",
                "Draft",
                "WaitingForApproval",
              ] satisfies PurposeVersionState[],
            },
          } satisfies ReadModelFilter<Purpose>,
          { projection: { data: true } }
        )
        .map(({ data }) => Purpose.parse(data))
        .toArray();
    },
    async getAgreements(delegation: DelegationV2): Promise<Agreement[]> {
      return await agreements
        .find(
          {
            "data.eserviceId": delegation.eserviceId,
            "data.consumerId": delegation.delegatorId,
            "data.state": {
              $in: [
                "Active",
                "Suspended",
                "Draft",
                "MissingCertifiedAttributes",
                "Pending",
              ] satisfies AgreementState[],
            },
          } satisfies ReadModelFilter<Agreement>,
          { projection: { data: true } }
        )
        .map(({ data }) => Agreement.parse(data))
        .toArray();
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
