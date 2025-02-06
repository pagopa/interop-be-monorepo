import { match } from "ts-pattern";
import {
  agreementState,
  DelegationId,
  DelegationV2,
  purposeVersionState,
} from "pagopa-interop-models";
import { InteropHeaders } from "pagopa-interop-commons";
import {
  AgreementProcessClient,
  PurposeProcessClient,
} from "./clients/clientsProvider.js";
import { ReadModelService } from "./readModelService.js";

export const processPurposes = async ({
  readModelService,
  purposeProcessClient,
  headers,
  delegationId,
}: {
  readModelService: ReadModelService;
  purposeProcessClient: PurposeProcessClient;
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
            params: { id: p.id },
            queries: { delegationId },
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
            },
            queries: { delegationId },
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
  readModelService: ReadModelService;
  agreementProcessClient: AgreementProcessClient;
  headers: InteropHeaders;
  delegation: DelegationV2;
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
            params: { agreementId: a.id },
            queries: { delegationId: delegation.id },
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
            params: { agreementId: a.id },
            queries: { delegationId: delegation.id },
            headers,
          }
        );
      }
    })
  );
};
