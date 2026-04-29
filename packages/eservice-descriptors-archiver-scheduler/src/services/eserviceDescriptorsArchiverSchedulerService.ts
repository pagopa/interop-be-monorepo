/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { Logger } from "pagopa-interop-commons";

import { ReadModelServiceSQL } from "./readModelServiceSQL.js";
import { CatalogProcessZodiosClient } from "./catalogProcessClient.js";

export function eserviceDescriptorsArchiverSchedulerServiceBuilder({
  readModelService,
  loggerInstance,
  catalogProcessClient,
}: {
  readModelService: ReadModelServiceSQL;
  loggerInstance: Logger;
  catalogProcessClient: CatalogProcessZodiosClient;
}) {
  loggerInstance.info("Archiving descriptors from read-model...");
  return async (): Promise<void> => {
    loggerInstance.info(
      "Getting expired archivable descriptors references from read-model...\n"
    );
    const refs = await readModelService.getExpiredArchivableDescriptorRefs();

    Promise.all(
      refs.map(async (ref) => {
        loggerInstance.info(
          `Archiving descriptor with id ${ref.descriptorId} of e-service with id ${ref.eserviceId}...`
        );
        catalogProcessClient.archiveDescriptor(undefined, {
          params: {
            eServiceId: ref.eserviceId,
            descriptorId: ref.descriptorId,
          },
        });
      })
    );
  };
}
