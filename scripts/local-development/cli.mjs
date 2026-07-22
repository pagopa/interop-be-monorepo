#!/usr/bin/env node
import { KMSClient, SignCommand } from "@aws-sdk/client-kms";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSelfcareTenantSeed,
  buildSessionClaims,
  buildTokenPayload,
  selectIdentity,
} from "./local-environment.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const datasetPath = resolve(repositoryRoot, "docker/local-development/dataset.json");
const statePath = resolve(repositoryRoot, ".local-development/state.json");
const keyId = "ffcc9b5b-4612-49b1-9374-9d203a3834f2";

const argument = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

const readJson = async (path, fallback) => {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT" && fallback !== undefined) return fallback;
    throw error;
  }
};

const writeJson = async (path, value) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
};

const base64Url = (value) => Buffer.from(value).toString("base64url");

const signPayload = async (payload) => {
  const header = { alg: "RS256", typ: "at+jwt", kid: keyId, use: "sig" };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(
    JSON.stringify(payload)
  )}`;
  const client = new KMSClient({
    endpoint: process.env.LOCAL_KMS_ENDPOINT ?? "http://localhost:4566",
    region: "eu-south-1",
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });
  const response = await client.send(
    new SignCommand({
      KeyId: keyId,
      Message: new TextEncoder().encode(unsigned),
      SigningAlgorithm: "RSASSA_PKCS1_V1_5_SHA_256",
    })
  );
  if (!response.Signature) throw new Error("Local KMS returned no signature");
  return `${unsigned}.${Buffer.from(response.Signature).toString("base64url")}`;
};

const generateSystemToken = (kind) =>
  signPayload(
    buildTokenPayload({
      kind,
      now: Math.floor(Date.now() / 1000),
      durationSeconds: 3600,
    })
  );

const generateSessionToken = async (dataset, state, tenantKey, role) => {
  const identity = selectIdentity(dataset, state, tenantKey, role);
  return signPayload(
    buildTokenPayload({
      claims: buildSessionClaims(identity),
      kind: "session",
      now: Math.floor(Date.now() / 1000),
      durationSeconds: 86400,
    })
  );
};

const requestJson = async (url, { token, method = "GET", body } = {}) => {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Correlation-Id": crypto.randomUUID(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    const error = new Error(`${method} ${url} failed (${response.status}): ${text}`);
    error.status = response.status;
    throw error;
  }
  return parsed;
};

const waitFor = async (description, check, timeoutSeconds = 90) => {
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    try {
      const result = await check();
      if (result) return result;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000));
  }
  throw new Error(`Timed out waiting for ${description}`);
};

const seed = async () => {
  const dataset = await readJson(datasetPath);
  const state = await readJson(statePath, { datasetVersion: dataset.version, tenants: {} });
  const tenantUrl = process.env.TENANT_PROCESS_URL ?? "http://localhost:3500";
  const catalogUrl = process.env.CATALOG_PROCESS_URL ?? "http://localhost:3000";
  const internalToken = await generateSystemToken("internal");

  await waitFor("tenant process", () => fetch(`${tenantUrl}/status`).then((r) => r.ok));

  for (const tenant of dataset.tenants) {
    let resource;
    try {
      resource = await requestJson(
        `${tenantUrl}/tenants/selfcare/${tenant.selfcareId}`,
        { token: internalToken }
      );
    } catch (error) {
      if (error.status !== 404) throw error;
      resource = await requestJson(`${tenantUrl}/selfcare/tenants`, {
        method: "POST",
        token: internalToken,
        body: buildSelfcareTenantSeed(tenant),
      });
    }
    state.tenants[tenant.key] = { id: resource.id };
    await writeJson(statePath, state);
  }

  const providerToken = await generateSessionToken(dataset, state, "provider", "admin");
  await waitFor("catalog process", () => fetch(`${catalogUrl}/status`).then((r) => r.ok));
  await waitFor("tenant readmodel propagation", async () => {
    await requestJson(`${tenantUrl}/tenants/${state.tenants.provider.id}`, {
      token: providerToken,
    });
    return true;
  });

  const existing = await requestJson(
    `${catalogUrl}/eservices?offset=0&limit=50&name=${encodeURIComponent("Catalogo Demo")}`,
    { token: providerToken }
  );
  let eservice = existing.results.find((item) => item.name === "Catalogo Demo");
  if (!eservice) {
    eservice = await requestJson(`${catalogUrl}/eservices`, {
      method: "POST",
      token: providerToken,
      body: {
        name: "Catalogo Demo",
        description: "E-service pubblicato dal seed dell'ambiente locale.",
        technology: "REST",
        mode: "DELIVER",
        personalData: false,
        descriptor: {
          audience: ["api.demo.local"],
          voucherLifespan: 86400,
          dailyCallsPerConsumer: 100,
          dailyCallsTotal: 1000,
          agreementApprovalPolicy: "AUTOMATIC"
        }
      },
    });
  }

  eservice = await waitFor("catalog readmodel propagation", () =>
    requestJson(`${catalogUrl}/eservices/${eservice.id}`, {
      token: providerToken,
    })
  );
  let descriptor = eservice.descriptors[0];
  if (eservice.personalData == null) {
    await requestJson(`${catalogUrl}/eservices/${eservice.id}`, {
      method: "PUT",
      token: providerToken,
      body: {
        name: eservice.name,
        description: eservice.description,
        technology: eservice.technology,
        mode: eservice.mode,
        isSignalHubEnabled: eservice.isSignalHubEnabled,
        isConsumerDelegable: eservice.isConsumerDelegable,
        isClientAccessDelegable: eservice.isClientAccessDelegable,
        personalData: false,
      },
    });
    eservice = await waitFor("catalog personal data flag propagation", async () => {
      const current = await requestJson(`${catalogUrl}/eservices/${eservice.id}`, {
        token: providerToken,
      });
      return current.personalData != null ? current : undefined;
    });
    descriptor = eservice.descriptors[0];
  }
  if (descriptor.state === "DRAFT" && !descriptor.interface) {
    await requestJson(
      `${catalogUrl}/eservices/${eservice.id}/descriptors/${descriptor.id}/documents`,
      {
        method: "POST",
        token: providerToken,
        body: {
          documentId: crypto.randomUUID(),
          kind: "INTERFACE",
          prettyName: "OpenAPI Demo",
          filePath: "local-development/openapi-demo.yaml",
          fileName: "openapi-demo.yaml",
          contentType: "application/yaml",
          checksum: "local-development",
          serverUrls: ["http://api.demo.local"]
        }
      }
    );
    eservice = await waitFor("catalog interface propagation", async () => {
      const current = await requestJson(`${catalogUrl}/eservices/${eservice.id}`, {
        token: providerToken,
      });
      return current.descriptors[0]?.interface ? current : undefined;
    });
    descriptor = eservice.descriptors[0];
  }
  if (descriptor.state === "DRAFT") {
    await requestJson(
      `${catalogUrl}/eservices/${eservice.id}/descriptors/${descriptor.id}/publish`,
      { method: "POST", token: providerToken }
    );
    await waitFor("published demo eservice", async () => {
      const current = await requestJson(`${catalogUrl}/eservices/${eservice.id}`, {
        token: providerToken,
      });
      return current.descriptors[0]?.state === "PUBLISHED";
    });
  }
  state.eservices = { demo: { id: eservice.id } };
  await writeJson(statePath, state);
  console.log(`Local base seed ready (${Object.keys(state.tenants).length} tenants)`);
};

const token = async () => {
  const dataset = await readJson(datasetPath);
  const state = await readJson(statePath);
  const tenantKey = argument("tenant", "comune");
  const role = argument("role", "admin");
  const serialized = await generateSessionToken(dataset, state, tenantKey, role);
  const output = argument("output");
  if (output) {
    const resolvedOutput = resolve(process.cwd(), output);
    await mkdir(dirname(resolvedOutput), { recursive: true });
    await writeFile(resolvedOutput, `${serialized}\n`, { mode: 0o600 });
  } else {
    process.stdout.write(`${serialized}\n`);
  }
};

const command = process.argv[2];
if (command === "seed") await seed();
else if (command === "token") await token();
else throw new Error("Usage: cli.mjs <seed|token> [--tenant KEY] [--role ROLE] [--output FILE]");
