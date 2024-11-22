import { zodiosRouter } from "@zodios/express";
import { bffApi } from "pagopa-interop-api-clients";

const healthRouter = zodiosRouter(bffApi.healthApi.api);

healthRouter.get("/status", async (_, res) => res.status(200).send());

export default healthRouter;
