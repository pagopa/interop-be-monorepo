import { CatalogProcessError, ErrorCode } from "../model/domain/errors.js";
import { convertToClientEServiceSeed } from "../model/domain/models.js";
import { ApiEServiceSeed } from "../model/types.js";
import { eserviceSeedToCreateEvent } from "../repositories/adapters/adapters.js";
import { eventRepository } from "../repositories/events.js";
import { readModelGateway } from "./ReadModelGateway.js";

export const catalogService = {
  async createEService(apiEservicesSeed: ApiEServiceSeed): Promise<void> {
    const organizationId = await readModelGateway.getOrganizationID();

    const eserviceSeed = convertToClientEServiceSeed(
      apiEservicesSeed,
      organizationId
    );

    const eservice = await readModelGateway.getEServiceByName(
      eserviceSeed.name
    );

    if (eservice !== undefined) {
      throw new CatalogProcessError(
        `Error during EService creation with name ${eserviceSeed.name}`,
        ErrorCode.DuplicateEserviceName
      );
    }

    return eventRepository.createEvent(eserviceSeedToCreateEvent(eserviceSeed));
  },
};
