import crypto from "crypto";
import { InteropHeaders, Logger, delay } from "pagopa-interop-commons";
import { Attribute, attributeKind } from "pagopa-interop-models";
import { config } from "../config/config.js";
import { ReadModelServiceSQL } from "./readModelService.js";
import { InteropClients } from "../client/client.js";

export const REGISTRY_ATTRIBUTES_SEEDS = {
  adesione: {
    name: "Adesione dal Registro Imprese",
    description:
      "Ente identificato come privato a seguito dell'accreditamento tramite il Registro Imprese",
    origin: "SELFCARE",
  },
  scp: {
    name: "Società a Controllo Pubblico - Registro Imprese",
    description:
      "Ente identificato come Società a Controllo Pubblico a seguito dell'accreditamento tramite Registro Imprese",
    origin: "SELFCARE",
  },
} as const;

export type RegistryAttributeLabels = keyof typeof REGISTRY_ATTRIBUTES_SEEDS;
export type ResolvedRegistryAttributes = Record<
  RegistryAttributeLabels,
  Attribute
>;

export function generateCodeFromName(name: string): string {
  return crypto.createHash("sha256").update(name).digest("hex");
}

export async function bootstrapRegistryAttributes(
  readmodel: ReadModelServiceSQL,
  attributeClient: InteropClients["attributeRegistryClient"],
  logger: Logger,
  headers: InteropHeaders
): Promise<ResolvedRegistryAttributes> {
  const entries = await Promise.all(
    Object.entries(REGISTRY_ATTRIBUTES_SEEDS).map(async ([key, seed]) => {
      const code = generateCodeFromName(seed.name);

      let attr = await readmodel.getAttributeByExternalId(seed.origin, code);

      if (!attr) {
        logger.info(`Attribute ${seed.name} not found. Creating...`);

        await attributeClient.createInternalCertifiedAttribute(
          {
            name: seed.name,
            description: seed.description,
            origin: seed.origin,
            code: code,
          },
          { headers }
        );

        let found = false;
        while (!found) {
          logger.info(
            `Waiting for attribute ${seed.name} to be available in ReadModel...`
          );
          await delay(config.attributeCreationWaitTime);
          found = await checkAttributePresence(readmodel, seed.origin, code);
        }

        attr = await readmodel.getAttributeByExternalId(seed.origin, code);
      }

      return [key, attr];
    })
  );

  return Object.fromEntries(entries) as ResolvedRegistryAttributes;
}

async function checkAttributePresence(
  readmodel: ReadModelServiceSQL,
  origin: string,
  code: string
): Promise<boolean> {
  const attr = await readmodel.getAttributeByExternalId(origin, code);
  return !!attr && attr.kind === attributeKind.certified;
}
