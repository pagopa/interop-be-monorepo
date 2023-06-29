/*  =======================================================================  
  IMPORTANT: This service mocks all operations performed throught read models 
===========================================================================  */

import { EService } from "../model/domain/models.js";

export interface IReadModelGateway {
  readonly getEServiceByName: (name: string) => Promise<EService>;
  readonly getOrganizationID: () => Promise<string>;
}

export const ReadModelGateway: IReadModelGateway = {
  getEServiceByName: async (_name: string): Promise<EService> => undefined,
  getOrganizationID: async (): Promise<string> =>
    "6A568A80-1B05-48EA-A74A-9A4C1B825CFB", // read organizaiotn id from context instead
};
