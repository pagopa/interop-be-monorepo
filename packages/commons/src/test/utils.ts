import { GenericContainer } from "testcontainers";
import { PostgreSqlContainer } from "@testcontainers/postgresql";

export const getMongodbContainer = ({
  dbName,
  username,
  password,
  port,
}: {
  username: string;
  password: string;
  dbName: string;
  port: number;
}): GenericContainer =>
  new GenericContainer("mongo:6.0.7")
    .withEnvironment({
      MONGO_INITDB_DATABASE: dbName,
      MONGO_INITDB_ROOT_USERNAME: username,
      MONGO_INITDB_ROOT_PASSWORD: password,
    })
    .withExposedPorts({ container: 27017, host: port });

export const getPostgreSqlContainer = ({
  dbName,
  username,
  password,
  port,
}: {
  dbName: string;
  username: string;
  password: string;
  port: number;
}): PostgreSqlContainer =>
  new PostgreSqlContainer("postgres:14")
    .withDatabase(dbName)
    .withUsername(username)
    .withPassword(password)
    .withCopyFilesToContainer([
      {
        source: "../../docker/event-store-init.sql",
        target: "/docker-entrypoint-initdb.d/01-init.sql",
      },
    ])
    .withExposedPorts({ container: 5432, host: port });
