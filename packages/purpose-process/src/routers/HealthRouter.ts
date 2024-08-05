import { zodiosRouter } from "@zodios/express";
import { purposeApi } from "pagopa-interop-api-clients";

const healthRouter = zodiosRouter(purposeApi.healthApi.api);

healthRouter.get("/status", async (_, res) => res.status(200).end());

export default healthRouter;
