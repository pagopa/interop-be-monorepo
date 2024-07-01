import { zodiosRouter } from "@zodios/express";
import { healthApi } from "../model/generated/api.js";

const healthRouter = zodiosRouter(healthApi.api);

healthRouter.get("/status", async (_, res) => res.status(200).end());

export default healthRouter;
