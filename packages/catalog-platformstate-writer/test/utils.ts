import { setupTestContainersVitest } from "pagopa-interop-commons-test/index.js";
import { afterEach, inject } from "vitest";

export const config = inject("tokenGenerationReadModelConfig");
export const { cleanup } = setupTestContainersVitest();

afterEach(cleanup);

// export const eservices = readModelRepository.eservices;
