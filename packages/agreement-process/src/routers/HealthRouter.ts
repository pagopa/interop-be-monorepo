import { zodiosRouter } from "@zodios/express";
import { agreementApi } from "pagopa-interop-api-clients";

const healthRouter = zodiosRouter(agreementApi.healthApi.api);

healthRouter.get("/status", async (_, res) => res.status(200).end());

export default healthRouter;
