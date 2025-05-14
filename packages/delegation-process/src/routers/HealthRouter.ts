import { zodiosRouter } from "@zodios/express";
import { delegationApi } from "pagopa-interop-api-clients";

const healthRouter = zodiosRouter(delegationApi.healthApi.api);

healthRouter.get("/status", async (_, res) => res.status(200).send());

export default healthRouter;
