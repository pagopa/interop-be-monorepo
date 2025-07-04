import { zodiosRouter } from "@zodios/express";
import { inAppNotificationApi } from "pagopa-interop-api-clients";

const healthRouter = zodiosRouter(inAppNotificationApi.healthApi.api);

healthRouter.get("/status", async (_, res) => res.status(200).send());

export default healthRouter;
