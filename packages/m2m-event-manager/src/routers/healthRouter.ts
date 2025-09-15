import { zodiosRouter } from "@zodios/express";
import { m2mEventApi } from "pagopa-interop-api-clients";

const healthRouter = zodiosRouter(m2mEventApi.healthApi.api);

healthRouter.get("/status", async (_, res) => res.status(200).send());

export default healthRouter;
