import { zodiosRouter } from "@zodios/express";
import { api } from "../model/generated/api.ts";
import { catalogService } from "../services/catalogService.ts";
import {
  ApiError,
  mapCatalogServiceErrorToApiError,
} from "../model/generated/types.ts";

const eservicesRouter = zodiosRouter(api.api);

eservicesRouter.post("/eservices", async (req, res) => {
  try {
    await catalogService.createEService(req.body);
    return res.status(201).end();
  } catch (error) {
    const errorRes: ApiError = mapCatalogServiceErrorToApiError(error);
    return res.status(errorRes.status).json(errorRes).end();
  }
});

export default eservicesRouter;
