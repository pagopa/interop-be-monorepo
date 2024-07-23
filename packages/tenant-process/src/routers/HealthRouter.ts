import { zodiosRouter } from "@zodios/express";
import { tenantApi } from "pagopa-interop-api-clients";

const healthRouter = zodiosRouter(tenantApi.healthApi.api);

healthRouter.get("/status", async (_, res) => res.status(200).end());

export default healthRouter;
