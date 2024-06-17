import { AppContext, WithLogger } from "pagopa-interop-commons";
import {
  PurposeId,
  PurposeVersionId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  ApiUpdateReversePurposePayload,
  VersionState,
  ApiEServicePurposeSeedPayload,
} from "../model/types.js";
import {
  PagoPAInteropBeClients,
  Headers,
} from "../providers/clientProvider.js";
import { purposeNotFound } from "../model/domain/errors.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeServiceBuilder(
  purposeClient: PagoPAInteropBeClients["purposeProcessClient"]
) {
  return {
    async createPurposeFromEService(
      createSeed: ApiEServicePurposeSeedPayload,
      { logger }: WithLogger<AppContext>,
      requestHeaders: Headers
    ): Promise<ReturnType<typeof purposeClient.createPurposeFromEService>> {
      logger.info("Creating purpose from e-service");
      return await purposeClient.createPurposeFromEService(createSeed, {
        headers: { ...requestHeaders },
        withCredentials: true,
      });
    },
    async reversePurposeUpdate(
      id: PurposeId,
      updateSeed: ApiUpdateReversePurposePayload,
      { logger }: WithLogger<AppContext>,
      requestHeaders: Headers
    ): Promise<{ purposeId: PurposeId; versionId: PurposeVersionId }> {
      logger.info(`Updating reverse purpose ${id}`);
      const updatedPurpose = await purposeClient.updateReversePurpose(
        updateSeed,
        {
          headers: { ...requestHeaders },
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
