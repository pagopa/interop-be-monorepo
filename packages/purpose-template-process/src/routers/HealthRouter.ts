import { zodiosRouter } from "@zodios/express";
import { purposeTemplateApi } from "pagopa-interop-api-clients";

const healthRouter = zodiosRouter(purposeTemplateApi.healthApi.api);

healthRouter.get("/status", async (_, res) => res.status(200).send());

export default healthRouter;
