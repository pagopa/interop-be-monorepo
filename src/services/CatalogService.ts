import { CatalogProcessError, ErrorCode } from "../model/domain/errors.js";
import {
  EService,
  EServiceSeed,
  convertToClientEServiceSeed,
} from "../model/domain/models.js";
import { ApiEServiceSeed } from "../model/types.js";

export interface ICatalogService {
  readonly createEService: (
    eservicesSeed: ApiEServiceSeed
  ) => Promise<EService>;
}

/* 
  =================================  
        TEMPORARY MOCK functions 
  =================================  
*/
const mockOrganizationID = "6A568A80-1B05-48EA-A74A-9A4C1B825CFB"; // read organizaiotn id from context instead
const mockSaveEService = async (eservice: EServiceSeed): Promise<EService> => ({
  ...eservice,
  descriptors: [],
  id: "6A568A80-1B05-48EA-A74A-9A4C1B825CFB",
});

const mockreadEServiceByName = async (_name: string): Promise<EService> =>
  undefined;
// =================================

export const CatalogService: ICatalogService = {
  createEService: async (eservicesSeed: ApiEServiceSeed): Promise<EService> => {
    const eserviceSeed = convertToClientEServiceSeed(
      eservicesSeed,
      mockOrganizationID
    );

    const eservice = await mockreadEServiceByName(eserviceSeed.name);
    if (eservice !== undefined) {
      throw new CatalogProcessError(
        `Error during EService creation with name ${eserviceSeed.name}`,
        ErrorCode.DuplicateEserviceName
      );
    }
    return await mockSaveEService(eserviceSeed);
  },
};
