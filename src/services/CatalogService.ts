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
  createEService: async (apiEservicesSeed: ApiEServiceSeed): Promise<void> => {
    const organizaiotId = await ReadModelGateway.getOrganizationID();

    const eserviceSeed = convertToClientEServiceSeed(
      apiEservicesSeed,
      organizaiotId
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
