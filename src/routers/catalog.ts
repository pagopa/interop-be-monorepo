import { zodiosRouter } from "@zodios/express";
import { api } from "../model/generated/api.ts";
import { catalogService } from "../services/CatalogService.ts";

const eservicesRouter = zodiosRouter(api.api);

eservicesRouter.post("/eservices", async (req, res) => {
  catalogService.createEService(req.body);
  return res.status(201).end();
});

export default eservicesRouter;
