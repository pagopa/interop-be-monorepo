import type { TestProject } from "vitest/node";

import {
  ContactDataDBConfig,
  ReadModelSQLDbConfig,
} from "pagopa-interop-commons";
import {
  contactDataDBContainer,
  postgreSQLReadModelContainer,
  TEST_POSTGRES_DB_PORT,
} from "pagopa-interop-commons-test";

declare module "vitest" {
  export interface ProvidedContext {
    contactDataDbConfig: ContactDataDBConfig;
  }
}

export default async function setup({
  provide,
}: TestProject): Promise<() => Promise<void>> {
  const config = ContactDataDBConfig.parse({});
  const container = await contactDataDBContainer(config).start();

  provide("contactDataDbConfig", {
    ...config,
    contactDataDBHost: container.getHost(),
    contactDataDBPort: container.getMappedPort(TEST_POSTGRES_DB_PORT),
  });

  // "readModelSQLConfig" is declared in the ProvidedContext by commons-test.
  const readModelSQLConfig = ReadModelSQLDbConfig.parse({});
  const readModelContainer =
    await postgreSQLReadModelContainer(readModelSQLConfig).start();

  provide("readModelSQLConfig", {
    ...readModelSQLConfig,
    readModelSQLDbHost: readModelContainer.getHost(),
    readModelSQLDbPort: readModelContainer.getMappedPort(TEST_POSTGRES_DB_PORT),
  });

  return async () => {
    await readModelContainer.stop();
    await container.stop();
  };
}
