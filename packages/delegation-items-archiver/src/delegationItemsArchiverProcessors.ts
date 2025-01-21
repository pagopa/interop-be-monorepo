import { match } from "ts-pattern";
import { DelegationId, purposeVersionState } from "pagopa-interop-models";
import { InteropHeaders } from "pagopa-interop-commons";
import { PurposeProcessClient } from "./clients/clientsProvider.js";
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
          .otherwise(() => false)
      );
      if (isDeletable) {
        return purposeProcessClient.deletePurpose(undefined, {
          params: { id: p.id },
          headers,
        });
      }

      const activeOrSuspendedVersion = p.versions.find((v) =>
        match(v.state)
          .with(
            purposeVersionState.active,
            purposeVersionState.suspended,
            () => true
          )
          .otherwise(() => false)
      );
      if (activeOrSuspendedVersion) {
        return purposeProcessClient.archivePurposeVersion(undefined, {
          params: {
            purposeId: p.id,
            versionId: activeOrSuspendedVersion.id,
          },
          headers,
        });
      }

      return Promise.resolve();
    })
  );
};
