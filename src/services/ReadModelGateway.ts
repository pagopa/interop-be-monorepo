/*  =======================================================================
  IMPORTANT: This service mocks all operations performed throught read models
===========================================================================  */

import { EService } from "../model/domain/models.js";

export const readModelGateway = {
  async getEServiceById(_id: string): Promise<EService | undefined> {
    return undefined;
  },
  async getEServiceByName(_name: string): Promise<EService | undefined> {
    return undefined;
  },
};
