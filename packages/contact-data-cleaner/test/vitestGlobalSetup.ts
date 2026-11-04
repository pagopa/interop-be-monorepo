import type { TestProject } from "vitest/node";

import { ContactDataDBConfig } from "pagopa-interop-commons";
import {
  contactDataDBContainer,
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

  return async () => {
    await container.stop();
  };
}
