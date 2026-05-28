/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { AxiosError } from "axios";
import pLimit from "p-limit";
import { Logger, RefreshableInteropToken } from "pagopa-interop-commons";
import { CorrelationId, EServiceId, generateId } from "pagopa-interop-models";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";
import { CatalogProcessZodiosClient } from "./catalogProcessClient.js";
import { config } from "../config/config.js";
import { ArchivableDescriptorRef } from "../models/models.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const getHeaders = (correlationId: CorrelationId, token: string) => ({
  "X-Correlation-Id": correlationId,
  Authorization: `Bearer ${token}`,
});

const isAlreadyArchivedErrorResponse = (error: unknown): error is AxiosError =>
  error instanceof AxiosError && error.response?.status === 409;

const limit = pLimit(config.catalogApiConcurrency);

export function eserviceDescriptorsScheduledArchiverServiceBuilder({
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
  const archiveDescriptor = async (ref: ArchivableDescriptorRef) => {
    loggerInstance.info(
      `Archiving descriptor with id ${ref.descriptorId} of e-service with id ${ref.eserviceId}...`
    );
    try {
      const token = (await refreshableToken.get()).serialized;
      const correlationId: CorrelationId = generateId();
      const headers = getHeaders(correlationId, token);
      await catalogProcessClient.archiveDescriptor(
        { kind: "MANUAL" },
        {
          params: {
            eServiceId: ref.eserviceId,
            descriptorId: ref.descriptorId,
          },
          headers,
        }
      );
    } catch (error) {
      if (isAlreadyArchivedErrorResponse(error)) {
        loggerInstance.warn(
          `Descriptor ${ref.descriptorId} is already archived`
        );
      } else {
        loggerInstance.error(
          `Error while archiving descriptor with id ${ref.descriptorId} of e-service with id ${ref.eserviceId}: ${error}`
        );
      }
    }
  };

  const archiveEService = async (eServiceId: EServiceId) => {
    loggerInstance.info(`Archiving e-service with id ${eServiceId}...`);
    try {
      const token = (await refreshableToken.get()).serialized;
      const correlationId: CorrelationId = generateId();
      const headers = getHeaders(correlationId, token);
      await catalogProcessClient.archiveEService(undefined, {
        params: {
          eServiceId,
        },
        headers,
      });
    } catch (error) {
      if (isAlreadyArchivedErrorResponse(error)) {
        loggerInstance.warn(`e-service ${eServiceId} is already archived`);
      } else {
        loggerInstance.error(
          `Error while archiving e-service with id ${eServiceId}: ${error}`
        );
      }
    }
  };
  return {
    async archiveDescriptors(): Promise<void> {
      loggerInstance.info("Archiving descriptors...");
      loggerInstance.info("Getting archivable descriptors references...");
      const descriptorRefs =
        await readModelService.getArchivableDescriptorsRefs();

      await Promise.all(
        descriptorRefs.map(await limit(() => archiveDescriptor))
      );
    },
    async archiveEServices(): Promise<void> {
      loggerInstance.info("Archiving e-services...");
      loggerInstance.info("Getting archivable e-services references...");
      const eserviceIds = await readModelService.getArchivableEservicesRefs();
      const eservicesWithUnarchivableDescriptors =
        await readModelService.getEServicesWithUnarchivableDescriptors(
          eserviceIds
        );

      if (eservicesWithUnarchivableDescriptors.length > 0) {
        loggerInstance.warn(
          `Found ${eservicesWithUnarchivableDescriptors.length} e-services with unarchivable descriptors to be archived...`
        );
        eservicesWithUnarchivableDescriptors.forEach(
          (eserviceWithUnarchivableDescriptors) => {
            loggerInstance.warn(
              `e-service with id ${eserviceWithUnarchivableDescriptors.eserviceId} has unarchivable descriptors: ${JSON.stringify(
                eserviceWithUnarchivableDescriptors.unarchivableDescriptors
              )}`
            );
          }
        );
      }

      const eservicesWithUnarchivableDescriptorsIds =
        eservicesWithUnarchivableDescriptors.map(
          (eserviceWithUnarchivableDescriptors) =>
            eserviceWithUnarchivableDescriptors.eserviceId
        );

      const correctEservicesIds = eserviceIds.filter(
        (eserviceId) =>
          !eservicesWithUnarchivableDescriptorsIds.includes(eserviceId)
      );

      await Promise.all(
        correctEservicesIds.map(await limit(() => archiveEService))
      );
    },
  };
}
