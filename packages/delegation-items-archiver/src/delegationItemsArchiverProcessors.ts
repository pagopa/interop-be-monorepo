import { match } from "ts-pattern";
import {
  agreementState,
  Delegation,
  DelegationId,
  purposeVersionState,
} from "pagopa-interop-models";
import { InteropHeaders } from "pagopa-interop-commons";
import { agreementApi, purposeApi } from "pagopa-interop-api-clients";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

export const processPurposes = async ({
  readModelService,
  purposeProcessClient,
  headers,
  delegationId,
}: {
  readModelService: ReadModelServiceSQL;
  purposeProcessClient: purposeApi.PurposeProcessClient;
  headers: InteropHeaders;
  delegationId: DelegationId;
}): Promise<void> => {
  const purposes = await readModelService.getPurposes(delegationId);

  await Promise.all(
    purposes.map(async (p) => {
      const isDeletable = p.versions.every((v) =>
        match(v.state)
          .with(
            purposeVersionState.draft,
            purposeVersionState.waitingForApproval,
            () => true
          )
          .with(
            purposeVersionState.archived,
            purposeVersionState.rejected,
            purposeVersionState.active,
            purposeVersionState.suspended,
            () => false
          )
          .exhaustive()
      );
      if (isDeletable) {
        return purposeProcessClient.internalDeletePurposeAfterDelegationRevocation(
          undefined,
          {
            params: { id: p.id, delegationId },
            headers,
          }
        );
      }

      const activeOrSuspendedVersion = p.versions.find((v) =>
        match(v.state)
          .with(
            purposeVersionState.active,
            purposeVersionState.suspended,
            () => true
          )
          .with(
            purposeVersionState.archived,
            purposeVersionState.rejected,
            purposeVersionState.draft,
            purposeVersionState.waitingForApproval,
            () => false
          )
          .exhaustive()
      );
      if (activeOrSuspendedVersion) {
        return purposeProcessClient.internalArchivePurposeVersionAfterDelegationRevocation(
          undefined,
          {
            params: {
              purposeId: p.id,
              versionId: activeOrSuspendedVersion.id,
              delegationId,
            },
            headers,
          }
        );
      }
    })
  );
};

export const processAgreement = async ({
  readModelService,
  agreementProcessClient,
  headers,
  delegation,
}: {
  readModelService: ReadModelServiceSQL;
  agreementProcessClient: agreementApi.AgreementProcessClient;
  headers: InteropHeaders;
  delegation: Delegation;
}): Promise<void> => {
  const agreements = await readModelService.getAgreements(delegation);

  await Promise.all(
    agreements.map(async (a) => {
      const isDeletable = match(a.state)
        .with(
          agreementState.draft,
          agreementState.missingCertifiedAttributes,
          agreementState.pending,
          () => true
        )
        .with(
          agreementState.rejected,
          agreementState.archived,
          agreementState.suspended,
          agreementState.active,
          () => false
        )
        .exhaustive();

      if (isDeletable) {
        await agreementProcessClient.internalDeleteAgreementAfterDelegationRevocation(
          undefined,
          {
            params: { agreementId: a.id, delegationId: delegation.id },
            headers,
          }
        );
      }

      const activeOrSuspendedAgreement = match(a.state)
        .with(agreementState.active, agreementState.suspended, () => true)
        .with(
          agreementState.draft,
          agreementState.archived,
          agreementState.rejected,
          agreementState.missingCertifiedAttributes,
          agreementState.pending,
          () => false
        )
        .exhaustive();

      if (activeOrSuspendedAgreement) {
        await agreementProcessClient.internalArchiveAgreementAfterDelegationRevocation(
          undefined,
          {
            params: { agreementId: a.id, delegationId: delegation.id },
            headers,
          }
        );
      }
    })
  );
};
