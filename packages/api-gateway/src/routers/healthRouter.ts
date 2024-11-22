import { zodiosRouter } from "@zodios/express";
import { apiGatewayApi } from "pagopa-interop-api-clients";

const healthRouter = zodiosRouter(apiGatewayApi.healthApi.api);

healthRouter.get("/status", async (_, res) => res.status(200).send());

export default healthRouter;
