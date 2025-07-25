import { zodiosRouter } from "@zodios/express";
import { notificationConfigApi } from "pagopa-interop-api-clients";

const healthRouter = zodiosRouter(notificationConfigApi.healthApi.api);

healthRouter.get("/status", async (_, res) => res.status(200).send());

export default healthRouter;
