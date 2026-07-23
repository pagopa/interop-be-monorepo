import { Network } from "testcontainers";

/**
 * Creates and starts a shared docker network for the test infrastructure
 * containers. Intended to be created once in global test setup and passed
 * to each `setup*TestContainer` function so they all sit on the same
 * network and can talk to each other.
 */
export async function createTestInfraNetwork() {
  return await new Network().start();
}
