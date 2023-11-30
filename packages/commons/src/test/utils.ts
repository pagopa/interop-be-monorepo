import { GenericContainer } from "testcontainers";
import { PostgreSqlContainer } from "@testcontainers/postgresql";

export const getMongodbContainer = ({
  dbName,
  username,
  password,
}: {
  username: string;
  password: string;
  dbName: string;
}): GenericContainer =>
  new GenericContainer("mongo:4.0.0")
    .withEnvironment({
      MONGO_INITDB_DATABASE: dbName,
      MONGO_INITDB_ROOT_USERNAME: username,
      MONGO_INITDB_ROOT_PASSWORD: password,
    })
    .withExposedPorts(27017);

export const getPostgreSqlContainer = ({
  dbName,
  username,
  password,
}: {
  dbName: string;
  username: string;
  password: string;
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
    .withExposedPorts(5432);
