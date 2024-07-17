import { zodiosRouter } from "@zodios/express";
import { attributeRegistryApi } from "pagopa-interop-api-clients";

const healthRouter = zodiosRouter(attributeRegistryApi.healthApi.api);

healthRouter.get("/status", async (_, res) => res.status(200).end());

export default healthRouter;
