import { ZodiosBodyByPath } from "@zodios/core";
import { api } from "../model/generated/api.ts";
import { IEServiceSeed } from "../model/domain/models.ts";
import IGenericError from "../model/domain/errors.ts";

type Api = typeof api.api;
type EServiceSeed = ZodiosBodyByPath<Api, "post", "/eservices">;

export interface ICatalogService {
  readonly createEService: (
    eservicesSeed: EServiceSeed
  ) => IEServiceSeed | IGenericError;
}

export const catalogService: ICatalogService = {
  createEService: (
    eservicesSeed: EServiceSeed
  ): IEServiceSeed | IGenericError => ({
    attributes: {
      certified: [],
      declared: [],
      verified: [],
    },
    description: eservicesSeed.description,
    name: eservicesSeed.name,
    technology: eservicesSeed.technology,
  }),
};
