import { WithLogger } from "pagopa-interop-commons";
import {
  PurposeId,
  PurposeVersionId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  ApiUpdateReversePurposePayload,
  VersionState,
} from "../model/types.js";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { purposeNotFound } from "../model/domain/errors.js";
import { BffAppContext } from "../utilities/context.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeServiceBuilder(
  purposeClient: PagoPAInteropBeClients["purposeProcessClient"]
) {
  return {
    async reversePurposeUpdate(
      id: PurposeId,
      updateSeed: ApiUpdateReversePurposePayload,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<{ purposeId: PurposeId; versionId: PurposeVersionId }> {
      logger.info(`Updating reverse purpose ${id}`);
      const updatedPurpose = await purposeClient.updateReversePurpose(
        updateSeed,
        {
          headers,
          withCredentials: true,
          params: {
            id,
          },
        }
      );

      const statesToExclude: VersionState[] = [
        "WAITING_FOR_APPROVAL",
        "REJECTED",
      ];
      const versionId = updatedPurpose.versions
        .filter((v) => !statesToExclude.includes(v.state))
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
        .map((v) => unsafeBrandId<PurposeVersionId>(v.id))
        .pop();

      if (versionId === undefined) {
        throw purposeNotFound(id);
      }

      return { purposeId: id, versionId };
    },
  };
}
