import { CatalogProcessError, ErrorCode } from "../model/domain/errors.js";
import { convertToClientEServiceSeed } from "../model/domain/models.js";
import { ApiEServiceSeed } from "../model/types.js";
import { eserviceSeedToCreateEvent } from "../repositories/adapters/adapters.js";
import { events } from "../repositories/db.js";
import { readModelGateway } from "./ReadModelGateway.js";

export interface ICatalogService {
  readonly createEService: (apiEServicesSeed: ApiEServiceSeed) => Promise<void>;
}

export const catalogService: ICatalogService = {
  async createEService(apiEservicesSeed: ApiEServiceSeed): Promise<void> {
    const organizationtId = await readModelGateway.getOrganizationID();

    const eserviceSeed = convertToClientEServiceSeed(
      apiEservicesSeed,
      organizationtId
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

    await events.createEvent(eserviceSeedToCreateEvent(eserviceSeed));
  },
};
