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
          catalogProcessClient.archiveDescriptor(
            { kind: "MANUAL" },
            {
              params: {
                eServiceId: ref.eserviceId,
                descriptorId: ref.descriptorId,
              },
              headers,
            }
          );
        })
      );
    },
    async archiveEServices(): Promise<void> {
      loggerInstance.info("Archiving e-services from read-model...");
      loggerInstance.info(
        "Getting expired archivable e-services references from read-model...\n"
      );
      const eserviceIds = await readModelService.getArchivableEserviceRefs();
      const EServiceWithUnarchivableDescriptors =
        await readModelService.getEServiceWithUnarchivableDescriptors(
          eserviceIds
        );

      if (EServiceWithUnarchivableDescriptors.length > 0) {
        loggerInstance.warn(
          `Found ${EServiceWithUnarchivableDescriptors.length} e-services with wrong descriptors to be archived...`
        );
        EServiceWithUnarchivableDescriptors.forEach(
          (EServiceWithUnarchivableDescriptors) => {
            loggerInstance.warn(
              `e-service with id ${EServiceWithUnarchivableDescriptors.eserviceId} has wrong descriptors: ${JSON.stringify(
                EServiceWithUnarchivableDescriptors.unarchivableDescriptors
              )}`
            );
          }
        );
      }

      const EServiceWithUnarchivableDescriptorsIds =
        EServiceWithUnarchivableDescriptors.map(
          (EServiceWithUnarchivableDescriptors) =>
            EServiceWithUnarchivableDescriptors.eserviceId
        );

      const correctEservicesIds = eserviceIds.filter(
        (eserviceId) =>
          !EServiceWithUnarchivableDescriptorsIds.includes(eserviceId)
      );

      Promise.all(
        correctEservicesIds.map(async (eServiceId) => {
          loggerInstance.info(`Archiving e-service with id ${eServiceId}...`);
          const token = (await refreshableToken.get()).serialized;
          const correlationId: CorrelationId = generateId();
          const headers = getHeaders(correlationId, token);
          catalogProcessClient.archiveEService(undefined, {
            params: {
              eServiceId,
            },
            headers,
          });
        })
      );
    },
  };
}
