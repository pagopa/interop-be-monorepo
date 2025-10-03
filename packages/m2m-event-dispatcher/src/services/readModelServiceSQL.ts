import { and, eq } from "drizzle-orm";
import {
  Delegation,
  EService,
  EServiceId,
  TenantId,
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
  async function getActiveProducerDelegation(
    eserviceId: EServiceId,
    delegatorId: TenantId
  ): Promise<Delegation | undefined> {
    const delegation =
      await delegationReadModelServiceSQL.getDelegationByFilter(
        and(
          eq(delegationInReadmodelDelegation.eserviceId, eserviceId),
          eq(delegationInReadmodelDelegation.state, delegationState.active),
          eq(
            delegationInReadmodelDelegation.kind,
            delegationKind.delegatedProducer
          ),
          eq(delegationInReadmodelDelegation.delegatorId, delegatorId)
        )
      );
    return delegation?.data;
  }

  return {
    async getActiveProducerDelegationForEService(
      eservice: EService
    ): Promise<Delegation | undefined> {
      return getActiveProducerDelegation(eservice.id, eservice.producerId);
    },
  };
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
