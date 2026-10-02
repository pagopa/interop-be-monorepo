/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { AxiosError } from "axios";
import pLimit from "p-limit";
import {
  Logger,
  RefreshableInteropToken,
  retry,
  CORRELATION_ID_HEADER,
} from "pagopa-interop-commons";
import {
  CorrelationId,
  DescriptorId,
  EServiceId,
  generateId,
} from "pagopa-interop-models";

import { config } from "../config/config.js";
import { ArchivableDescriptorRef, Headers } from "../models/models.js";
import { CatalogProcessZodiosClient } from "./catalogProcessClient.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

const getHeaders = (correlationId: CorrelationId, token: string): Headers => ({
  [CORRELATION_ID_HEADER]: correlationId,
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
  const checkDescriptorIsArchived = async (
    eServiceId: EServiceId,
    descriptorId: DescriptorId,
    headers: Headers
  ): Promise<void> => {
    const eservice = await catalogProcessClient.getEServiceById({
      params: {
        eServiceId,
      },
      headers,
    });
    const descriptor = eservice.descriptors.find((d) => d.id === descriptorId);
    if (!descriptor) {
      throw new Error("Descriptor not found");
    }
    if (descriptor.state !== "ARCHIVED") {
      throw new Error("Descriptor not archived");
    }
  };

  const archiveDescriptor = async (
    ref: ArchivableDescriptorRef
  ): Promise<boolean> => {
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
      await retry(
        () =>
          checkDescriptorIsArchived(ref.eserviceId, ref.descriptorId, headers),
        {
          retries: config.defaultPollingMaxRetries,
          delay: config.defaultPollingRetryDelay,
        }
      );
      return true;
    } catch (error) {
      if (isAlreadyArchivedErrorResponse(error)) {
        loggerInstance.warn(
          `Descriptor ${ref.descriptorId} is already archived`
        );
        return true;
      } else {
        loggerInstance.error(
          `Error while archiving descriptor with id ${ref.descriptorId} of e-service with id ${ref.eserviceId}: ${error}`
        );
        return false;
      }
    }
  };

  const archiveEService = async (eServiceId: EServiceId): Promise<boolean> => {
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
      return true;
    } catch (error) {
      if (isAlreadyArchivedErrorResponse(error)) {
        loggerInstance.warn(`e-service ${eServiceId} is already archived`);
        return true;
      } else {
        loggerInstance.error(
          `Error while archiving e-service with id ${eServiceId}: ${error}`
        );
        return false;
      }
    }
  };
  return {
    async archiveDescriptors(): Promise<boolean> {
      loggerInstance.info("Archiving descriptors...");
      loggerInstance.info("Getting archivable descriptors references...");
      const descriptorRefs =
        await readModelService.getArchivableDescriptorsRefs();

      const results: boolean[] = [];

      for (const descriptorRef of descriptorRefs) {
        results.push(await archiveDescriptor(descriptorRef));
      }

      const success = results.every((success) => success);

      if (!success) {
        const errorLength = results.filter((success) => !success).length;
        loggerInstance.error(
          `${errorLength}/${results.length} descriptors were not successfully archived`
        );
      }

      return success;
    },
    async archiveEServices(): Promise<boolean> {
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

      const results = await Promise.all(
        correctEservicesIds.map((id) => limit(() => archiveEService(id)))
      );

      const success = results.every((success) => success);

      if (!success) {
        const errorLength = results.filter((success) => !success).length;
        loggerInstance.error(
          `${errorLength}/${results.length} E-Services were not successfully archived`
        );
      }

      return success;
    },
  };
}
