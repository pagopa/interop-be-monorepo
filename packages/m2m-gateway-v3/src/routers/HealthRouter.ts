import { zodiosRouter } from "@zodios/express";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";

const healthRouter = zodiosRouter(m2mGatewayApiV3.healthApi.api);

healthRouter.get("/status", async (_, res) => res.status(200).send());

export default healthRouter;
