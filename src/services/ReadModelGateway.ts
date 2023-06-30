/*  =======================================================================
  IMPORTANT: This service mocks all operations performed throught read models
===========================================================================  */

import { EService } from "../model/domain/models.js";

export const readModelGateway = {
  async getEServiceByName(_name: string): Promise<EService | undefined> {
    return undefined;
  },
  async getOrganizationID(): Promise<string> {
    return "6A568A80-1B05-48EA-A74A-9A4C1B825CFB"; // read organization id from context instead
  },
};
