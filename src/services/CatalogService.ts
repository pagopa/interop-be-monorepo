import { CatalogProcessError, ErrorCode } from "../model/domain/errors.js";
import { convertToClientEServiceSeed } from "../model/domain/models.js";
import { ApiEServiceSeed } from "../model/types.js";
import { eserviceSeedToCreateEvent } from "../repositories/adapters/adapters.js";
import { events } from "../repositories/db.js";
import { ReadModelGateway } from "./ReadModelGateway.js";

export interface ICatalogService {
  readonly createEService: (apiEServicesSeed: ApiEServiceSeed) => Promise<void>;
}

export const CatalogService: ICatalogService = {
  async createEService(apiEservicesSeed: ApiEServiceSeed): Promise<void> {
    const organizationtId = await ReadModelGateway.getOrganizationID();

    const eserviceSeed = convertToClientEServiceSeed(
      apiEservicesSeed,
      organizationtId
    );

    const eservice = await ReadModelGateway.getEServiceByName(
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
