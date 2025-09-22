import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import { m2mEventServiceBuilder } from "../src/services/m2mEventService.js";

export const { cleanup, m2mEventDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("m2mEventDbConfig")
);

afterEach(cleanup);

export const m2mEventService = m2mEventServiceBuilder(m2mEventDB);
