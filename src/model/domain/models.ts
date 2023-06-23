/* 
  NOTE: Temporary file to hold all the models imported from github packages
  This file will be removed once all models are converted from scala.
 */
import { z } from "zod";
import * as api from "../generated/api.ts";

// enum type should be shared between domain model and api model
export type EServiceTechnology = z.infer<typeof api.schemas.EServiceTechnology>;

export interface IEServiceSeed {
  readonly name: string;
  readonly description: string;
  readonly technology: EServiceTechnology;
  readonly attributes: IAttributesSeed;
}

export interface IAttributesSeed {
  readonly certified: ReadonlyArray<IAttributeSeed>;
  readonly declared: ReadonlyArray<IAttributeSeed>;
  readonly verified: ReadonlyArray<IAttributeSeed>;
}

export interface IAttributeSeed {
  readonly single: IAttributeValueSeed | null;
  readonly group: ReadonlyArray<IAttributeValueSeed> | null;
}

export interface IAttributeValueSeed {
  readonly id: string;
  readonly explicitAttributeVerification: boolean;
}
