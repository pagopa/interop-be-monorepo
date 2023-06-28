import { zodiosApp } from "@zodios/express";
import healthRouter from "./routers/health.js";
import eservicesRouter from "./routers/catalog.js";

const app = zodiosApp();
app.use(healthRouter, eservicesRouter);

export default app;
