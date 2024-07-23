import { zodiosRouter } from "@zodios/express";
import { authorizationApi } from "pagopa-interop-api-clients";

const healthRouter = zodiosRouter(authorizationApi.healthApi.api);

healthRouter.get("/status", async (_, res) => res.status(200).end());

export default healthRouter;
