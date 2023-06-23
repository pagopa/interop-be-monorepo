import { zodiosRouter } from "@zodios/express";
import { api } from "../model/generated/api.ts";

const healthRouter = zodiosRouter(api.api);

healthRouter.get("/status", async (_, res) => res.status(200).end());

export default healthRouter;
