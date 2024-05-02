import { logger } from "pagopa-interop-commons";
import { Agreement } from "pagopa-interop-models";

export async function archiveEserviceDescriptors(
  agreement: Agreement
): Promise<void> {
  logger.info(`Archiving eservice descriptors for agreement ${agreement.id}`);
  // TODO implement
}
