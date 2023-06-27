import { zodiosApp } from "@zodios/express";

const app = zodiosApp();

app.get("/health", (_, res) => res.status(200).send({ STATUS: "OK" }).end());

export default app;
