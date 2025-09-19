import { and, eq } from "drizzle-orm";
import {
  Delegation,
  EServiceV2,
  delegationKind,
  delegationState,
} from "pagopa-interop-models";
import { DelegationReadModelService } from "pagopa-interop-readmodel";
import { delegationInReadmodelDelegation } from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  delegationReadModelServiceSQL,
}: {
  delegationReadModelServiceSQL: DelegationReadModelService;
}) {
  return {
    async getActiveProducerDelegationForEService(
      eservice: EServiceV2
    ): Promise<Delegation | undefined> {
      const delegation =
        await delegationReadModelServiceSQL.getDelegationByFilter(
          and(
            eq(delegationInReadmodelDelegation.eserviceId, eservice.id),
            eq(delegationInReadmodelDelegation.state, delegationState.active),
            eq(
              delegationInReadmodelDelegation.kind,
              delegationKind.delegatedProducer
            ),
            eq(delegationInReadmodelDelegation.delegatorId, eservice.producerId)
          )
        );
      return delegation?.data;
    },
  };
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
