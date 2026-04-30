/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { Logger, RefreshableInteropToken } from "pagopa-interop-commons";

import { ReadModelServiceSQL } from "./readModelServiceSQL.js";
import { CatalogProcessZodiosClient } from "./catalogProcessClient.js";
import { CorrelationId, generateId } from "pagopa-interop-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const getHeaders = (correlationId: CorrelationId, token: string) => ({
  "X-Correlation-Id": correlationId,
  Authorization: `Bearer ${token}`,
});

export function eserviceDescriptorsArchiverSchedulerServiceBuilder({
  readModelService,
  loggerInstance,
  catalogProcessClient,
  refreshableToken,
}: {
  readModelService: ReadModelServiceSQL;
  loggerInstance: Logger;
  catalogProcessClient: CatalogProcessZodiosClient;
  refreshableToken: RefreshableInteropToken;
}) {
  return {
    async archiveDescriptors(): Promise<void> {
      loggerInstance.info("Archiving descriptors from read-model...");
      loggerInstance.info(
        "Getting expired archivable descriptors references from read-model...\n"
      );
      const refs = await readModelService.getExpiredArchivableDescriptorRefs();

      Promise.all(
        refs.map(async (ref) => {
          loggerInstance.info(
            `Archiving descriptor with id ${ref.descriptorId} of e-service with id ${ref.eserviceId}...`
          );
          const token = (await refreshableToken.get()).serialized;
          const correlationId: CorrelationId = generateId();
          const headers = getHeaders(correlationId, token);
          catalogProcessClient.archiveDescriptor("MANUAL", {
            params: {
              eServiceId: ref.eserviceId,
              descriptorId: ref.descriptorId,
            },
            headers,
          });
        })
      );
    },
  };
}
