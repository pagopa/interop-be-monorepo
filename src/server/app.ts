import { zodiosApp } from "@zodios/express";

const app = zodiosApp();
const port = 3000;

app.get("/health", (_, res) => res.status(200).send({ STATUS: "OK" }).end());

/* eslint-disable no-console */
app.listen(port, () => console.log(`App running on port ${port}`));
