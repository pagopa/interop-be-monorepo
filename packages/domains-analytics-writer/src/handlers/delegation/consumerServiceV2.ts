/* eslint-disable functional/immutable-data */
import {
  DelegationEventEnvelopeV2,
  fromDelegationV2,
  genericInternalError,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { splitDelegationIntoObjectsSQL } from "pagopa-interop-readmodel";
import { z } from "zod";
import { DBContext } from "../../db/db.js";
import { DelegationItemsSchema } from "../../model/delegation/delegation.js";
import { delegationServiceBuilder } from "../../service/delegationService.js";

export async function handleDelegationMessageV2(
  messages: DelegationEventEnvelopeV2[],
  dbContext: DBContext,
): Promise<void> {
  const delegationService = delegationServiceBuilder(dbContext);

  const upsertDelegationBatch: DelegationItemsSchema[] = [];

  for (const message of messages) {
    await match(message)
      .with(
        {
          type: P.union(
            "ProducerDelegationApproved",
            "ProducerDelegationRejected",
            "ProducerDelegationRevoked",
            "ProducerDelegationSubmitted",
            "ConsumerDelegationSubmitted",
            "ConsumerDelegationApproved",
            "ConsumerDelegationRejected",
            "ConsumerDelegationRevoked",
            "DelegationContractAdded",
          ),
        },
        async (msg) => {
          if (!msg.data.delegation) {
            throw genericInternalError(
              "Delegation can't be missing in event message",
            );
          }

          const splitResult = splitDelegationIntoObjectsSQL(
            fromDelegationV2(msg.data.delegation),
            msg.version,
          );

          upsertDelegationBatch.push(
            DelegationItemsSchema.parse({
              delegationSQL: splitResult.delegationSQL,
              stampsSQL: splitResult.stampsSQL,
              contractDocumentsSQL: splitResult.contractDocumentsSQL,
            } as z.input<typeof DelegationItemsSchema>),
          );
        },
      )
      .exhaustive();
  }

  if (upsertDelegationBatch.length > 0) {
    await delegationService.upsertBatchDelegation(
      dbContext,
      upsertDelegationBatch,
    );
  }
}
