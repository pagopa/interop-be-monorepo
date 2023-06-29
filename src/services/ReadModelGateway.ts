/*  =======================================================================  
  IMPORTANT: This service mocks all operations performed throught read models 
===========================================================================  */

import { EService } from "../model/domain/models.js";

export interface IReadModelGateway {
  readonly getEServiceByName: (name: string) => Promise<EService | undefined>;
  readonly getOrganizationID: () => Promise<string>;
}

export const readModelGateway: IReadModelGateway = {
  getEServiceByName: async (_name: string): Promise<EService | undefined> =>
    undefined,
  getOrganizationID: async (): Promise<string> =>
    "6A568A80-1B05-48EA-A74A-9A4C1B825CFB", // read organization id from context instead
};
