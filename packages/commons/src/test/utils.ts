import { GenericContainer } from "testcontainers";

export class SingletonMongodbContainer {
  private static instance: GenericContainer;

  public static init() {
    if (!SingletonMongodbContainer.instance) {
      SingletonMongodbContainer.instance = new GenericContainer("mongo:6.0.7")
        .withEnvironment({
          MONGO_INITDB_DATABASE: "readmodel",
          MONGO_INITDB_ROOT_USERNAME: "root",
          MONGO_INITDB_ROOT_PASSWORD: "example",
        })
        .withExposedPorts({ container: 27017, host: 27017 });
    }
    return SingletonMongodbContainer.instance;
  }
}
