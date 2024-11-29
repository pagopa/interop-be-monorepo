import { FileManager, Logger } from "pagopa-interop-commons";
import {
  Descriptor,
  EServiceId,
  genericInternalError,
} from "pagopa-interop-models";
import { config } from "./config/config.js";

export async function exportInterface(
  eserviceId: EServiceId,
  latestDescriptor: Descriptor,
  fileManager: FileManager,
  logger: Logger
): Promise<void> {
  logger.info(
    `Exporting Interface for EService ${eserviceId} and Descriptor ${latestDescriptor.id}`
  );

  if (latestDescriptor.interface === undefined) {
    throw genericInternalError(
      `Published Descriptor ${latestDescriptor.id} does not have an interface`
    );
  }

  const interfaceFile = await fileManager.get(
    config.eserviceDocumentsS3Bucket,
    latestDescriptor.interface.path,
    logger
  );

  await fileManager.storeBytes(
    {
      bucket: config.datalakeInterfacesExportS3Bucket,
      path: `${config.datalakeInterfacesExportPath}/${eserviceId}`,
      resourceId: latestDescriptor.id,
      name: latestDescriptor.interface.name,
      content: Buffer.from(interfaceFile),
    },
    logger
  );

  logger.info(
    `Interface ${latestDescriptor.interface.name} for Eservice ${eserviceId} and Descriptor ${latestDescriptor.id} exported successfully`
  );
}
