/* 
  NOTE: Temporary file to hold all the models imported from github packages
  This file will be removed once all models are converted from scala.
 */
import { z } from "zod";
import * as api from "../generated/api.js";
import { ApiEServiceSeed } from "../types.js";

export type EService = z.infer<typeof api.schemas.EService> & {
  version: number;
};

export type EServiceSeed = z.infer<typeof api.schemas.EServiceSeed> & {
  readonly producerId: string;
};

export const convertToClientEServiceSeed = (
  seed: ApiEServiceSeed,
  producerId: string
): EServiceSeed => ({
  ...seed,
  producerId,
});
