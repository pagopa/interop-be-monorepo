/* eslint-disable @typescript-eslint/no-empty-function */
import { it } from "vitest";

it("Should return 200 and populate authData when Token and DPoP are valid", async () => {});

it("Should return 400 if headers are missing or malformed", async () => {});

it("Should return 401 if Token Verification fails (crypto or missing cnf)", async () => {});

it("Should return 401 if DPoP Compliance fails (e.g. invalid signature)", async () => {});
