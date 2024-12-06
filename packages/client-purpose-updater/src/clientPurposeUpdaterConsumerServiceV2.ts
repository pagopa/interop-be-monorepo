import {
  CorrelationId,
  generateId,
  PurposeEventEnvelopeV2,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  getInteropHeaders,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { getInteropBeClients } from "./clients/clientsProvider.js";

const { authorizationClient } = getInteropBeClients();

export async function handleMessageV2(
  message: PurposeEventEnvelopeV2,
  refreshableToken: RefreshableInteropToken
): Promise<void> {
  await match(message)
    .with({ type: "PurposeArchived" }, async (purposeMsg) => {
      const token = (await refreshableToken.get()).serialized;
      const correlationId = generateId<CorrelationId>();
      const headers = getInteropHeaders({ token, correlationId });
      const maybePurposeId = purposeMsg.data.purpose?.id;

      if (!maybePurposeId) {
        return;
      }

      const purposeId = maybePurposeId;

      await authorizationClient.client.removePurposeFromClients(undefined, {
        params: { purposeId },
        headers,
      });
    })
    .with(
      { type: "PurposeAdded" },
      { type: "DraftPurposeUpdated" },
      { type: "NewPurposeVersionActivated" },
      { type: "NewPurposeVersionWaitingForApproval" },
      { type: "PurposeActivated" },
      { type: "PurposeVersionOverQuotaUnsuspended" },
      { type: "PurposeVersionRejected" },
      { type: "PurposeVersionSuspendedByConsumer" },
      { type: "PurposeVersionSuspendedByProducer" },
      { type: "PurposeVersionUnsuspendedByConsumer" },
      { type: "PurposeVersionUnsuspendedByProducer" },
      { type: "PurposeWaitingForApproval" },
      { type: "WaitingForApprovalPurposeVersionDeleted" },
      { type: "PurposeVersionActivated" },
      { type: "PurposeCloned" },
      { type: "DraftPurposeDeleted" },
      { type: "WaitingForApprovalPurposeDeleted" },
      () => Promise.resolve
    )
    .exhaustive();
}
