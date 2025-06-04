// /* eslint-disable no-console */
// /* eslint-disable functional/immutable-data */
// /* eslint-disable @typescript-eslint/explicit-function-return-type */
// import path from "node:path";
// import { promises as fs } from "fs";
// import {
//   AnalyticsSQLDbConfig,
//   EventStoreConfig,
//   FileManagerConfig,
//   ReadModelDbConfig,
//   ReadModelSQLDbConfig,
//   S3Config,
// } from "pagopa-interop-commons";
// import { GenericContainer, StartedTestContainer } from "testcontainers";
// import {
//   awsSESContainer,
//   dynamoDBContainer,
//   mailpitContainer,
//   minioContainer,
//   mongoDBContainer,
//   postgreSQLAnalyticsContainer,
//   postgreSQLContainer,
//   postgreSQLReadModelContainer,
//   redisContainer,
// } from "./containerTestUtils.js";

// // Percorso dove salvare il file .env che sarà caricato da dotenv-flow
// const ENV_FILE_PATH = path.join(process.cwd(), ".env");

// const eventStoreConfig = EventStoreConfig.safeParse(process.env);
// const readModelConfig = ReadModelDbConfig.safeParse(process.env);
// const readModelSQLConfig = ReadModelSQLDbConfig.safeParse(process.env);
// const analyticsSQLDbConfig = AnalyticsSQLDbConfig.safeParse(process.env);
// const fileManagerConfig = FileManagerConfig.safeParse(process.env);
// const s3Bucket =
//   S3Config.safeParse(process.env)?.data?.s3Bucket ?? "interop-local-bucket";

// if (!eventStoreConfig.success) {
//   throw Error("Errore");
// }

// if (!readModelConfig.success) {
//   throw Error("Errore");
// }

// if (!readModelSQLConfig.success) {
//   throw Error("Errore");
// }

// if (!analyticsSQLDbConfig.success) {
//   throw Error("Errore");
// }

// if (!fileManagerConfig.success) {
//   throw Error("Errore");
// }

// type ContainerInstance = GenericContainer | StartedTestContainer;

// interface ContainerEntry {
//   name: string;
//   instance: ContainerInstance;
// }

// const containers: ContainerEntry[] = [
//   {
//     name: "POSTGRES_DB_PORT",
//     instance: postgreSQLContainer(eventStoreConfig.data),
//   },
//   {
//     name: "POSTGRES_READ_MODEL_DB_PORT",
//     instance: postgreSQLReadModelContainer(readModelSQLConfig.data),
//   },
//   {
//     name: "POSTGRES_ANALYTICS_DB_PORT",
//     instance: postgreSQLAnalyticsContainer(analyticsSQLDbConfig.data),
//   },
//   { name: "REDIS_PORT", instance: redisContainer() },
//   {
//     name: "MINIO_PORT",
//     instance: minioContainer({
//       ...fileManagerConfig.data,
//       s3Bucket,
//     }),
//   },
//   { name: "MONGO_DB_PORT", instance: mongoDBContainer(readModelConfig.data) },
//   { name: "DYNAMODB_PORT", instance: dynamoDBContainer() },
//   { name: "MAILPIT_HTTP_PORT", instance: mailpitContainer() },
//   { name: "MAILPIT_SMTP_PORT", instance: mailpitContainer() },
//   { name: "AWS_SES_PORT", instance: awsSESContainer() },
// ];

// export async function startTestEnv() {
//   const envVars: Record<string, string> = {};

//   for (const containerObj of containers) {
//     if (
//       "start" in containerObj.instance &&
//       typeof containerObj.instance.start === "function"
//     ) {
//       // È GenericContainer, quindi posso avviare
//       const startedInstance = await containerObj.instance.start();
//       containerObj.instance = startedInstance;
//     }
//     // Ora instance è StartedTestContainer
//     const startedInstance = containerObj.instance as StartedTestContainer;
//     const port = startedInstance.getMappedPort(0);
//     envVars[`TEST_${containerObj.name}`] = port.toString();
//   }

//   const envContent = Object.entries(envVars)
//     .map(([key, value]) => `${key}=${value}`)
//     .join("\n");

//   await fs.writeFile(ENV_FILE_PATH, envContent, { encoding: "utf-8" });

//   console.log(`✅ Containers avviati. File .env generato in ${ENV_FILE_PATH}`);
// }

// export async function stopTestEnv() {
//   for (const { instance } of containers) {
//     if ("stop" in instance && typeof instance.stop === "function") {
//       await instance.stop();
//     }
//   }
//   console.log("🛑 Containers fermati.");
// }
