import { zodiosRouter } from "@zodios/express";
import { authorizationServerApi } from "pagopa-interop-api-clients";

const healthRouter = zodiosRouter(authorizationServerApi.healthApi.api);

healthRouter.get("/authorization-server/status", async (_, res) =>
  res.status(200).send()
);

export default healthRouter;
