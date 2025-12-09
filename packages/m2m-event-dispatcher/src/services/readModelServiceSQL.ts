import { and, eq } from "drizzle-orm";
import {
  Agreement,
  Delegation,
  EService,
  EServiceId,
  Purpose,
  TenantId,
  delegationKind,
  delegationState,
} from "pagopa-interop-models";
import {
  DelegationReadModelService,
  CatalogReadModelService,
} from "pagopa-interop-readmodel";
import { delegationInReadmodelDelegation } from "pagopa-interop-readmodel-models";
import { Delegations } from "../models/delegations.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  delegationReadModelServiceSQL,
  catalogReadModelServiceSQL,
}: {
  delegationReadModelServiceSQL: DelegationReadModelService;
  catalogReadModelServiceSQL: CatalogReadModelService;
}) {
  async function getActiveProducerDelegation(
    eserviceId: EServiceId
  ): Promise<Delegation | undefined> {
    const delegation =
      await delegationReadModelServiceSQL.getDelegationByFilter(
        and(
          eq(delegationInReadmodelDelegation.eserviceId, eserviceId),
          eq(delegationInReadmodelDelegation.state, delegationState.active),
          eq(
            delegationInReadmodelDelegation.kind,
            delegationKind.delegatedProducer
          )
        )
      );
    return delegation?.data;
  }

  async function getActiveConsumerDelegation(
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
            delegationKind.delegatedConsumer
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
      return getActiveProducerDelegation(eservice.id);
    },
    async getActiveDelegationsForAgreementOrPurpose(
      agreementOrPurpose: Agreement | Purpose
    ): Promise<Delegations> {
      return {
        producerDelegation: await getActiveProducerDelegation(
          agreementOrPurpose.eserviceId
        ),
        consumerDelegation: await getActiveConsumerDelegation(
          agreementOrPurpose.eserviceId,
          agreementOrPurpose.consumerId
        ),
      };
    },
    async getEServiceById(
      eserviceId: EServiceId
    ): Promise<EService | undefined> {
      return (await catalogReadModelServiceSQL.getEServiceById(eserviceId))
        ?.data;
    },
  };
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
