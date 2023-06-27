import { CatalogProcessError, ErrorCode } from "../model/domain/errors.ts";
import {
  EService,
  EServiceSeed,
  MaybeEservice,
  convertToClientEService,
} from "../model/domain/models.ts";
import { ApiEServiceSeed } from "../model/generated/types.ts";

export interface ICatalogService {
  readonly createEService: (
    eservicesSeed: ApiEServiceSeed
  ) => Promise<EService | typeof CatalogProcessError>;
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
const mockreadEServiceByName = async (_name: string): Promise<MaybeEservice> =>
  undefined;
// =================================

export const catalogService: ICatalogService = {
  createEService: async (
    eservicesSeed: ApiEServiceSeed
  ): Promise<EService | typeof CatalogProcessError> => {
    const eserviceSeed = convertToClientEService(
      eservicesSeed,
      mockOrganizationID
    );

    const mayBeService = await mockreadEServiceByName(eserviceSeed.name);
    if (mayBeService !== undefined) {
      throw new CatalogProcessError(
        `Error during EService creation with name ${eserviceSeed.name}`,
        ErrorCode.DuplicateEserviceName
      );
    }
    return await mockSaveEService(eserviceSeed);
  },
};
