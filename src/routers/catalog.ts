import { zodiosRouter } from "@zodios/express";
import { api } from "../model/generated/api.js";
import { ApiError, mapCatalogServiceErrorToApiError } from "../model/types.js";
import { catalogService } from "../services/CatalogService.js";

const eservicesRouter = zodiosRouter(api.api);

eservicesRouter
  .post("/eservices", async (req, res) => {
    try {
      await catalogService.createEService(req.body);
      return res.status(201).end();
    } catch (error) {
      const errorRes: ApiError = mapCatalogServiceErrorToApiError(error);
      return res.status(errorRes.status).json(errorRes).end();
    }
  })
  .put("/eservices/:eServiceId", async (req, res) => {
    try {
      await catalogService.updateEService(req.params.eServiceId, req.body);
      return res.status(200).end();
    } catch (error) {
      const errorRes: ApiError = mapCatalogServiceErrorToApiError(error);
      return res.status(errorRes.status).json(errorRes).end();
    }
  })
  .delete("/eservices/:eServiceId", async (req, res) => {
    try {
      await catalogService.deleteEService(req.params.eServiceId);
      return res.status(204).end();
    } catch (error) {
      const errorRes: ApiError = mapCatalogServiceErrorToApiError(error);
      return res.status(errorRes.status).json(errorRes).end();
    }
  });

export default eservicesRouter;
