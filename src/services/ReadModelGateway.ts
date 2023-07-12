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
  async getEServiceDescriptorDocumentById(_id: string): Promise<
    | {
        version: number;
        prettyName: string;
        name: string;
        contentType: string;
        path: string;
        checksum: string;
        serverUrls: string[];
        isInInterface: boolean;
      }
    | undefined
  > {
    return undefined;
  },
};
