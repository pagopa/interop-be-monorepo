import { setupTestContainersVitestGlobal } from "pagopa-interop-commons-test";

export default setupTestContainersVitestGlobal();

type AnyPgTable = {};
type AnyPgColumn<T = unknown> = {
  data: T;
};
type DrizzleTransactionType = {};
type SQL<T> = {
  [key: string]: unknown;
} & T;

function eq(...args: unknown[]): SQL<unknown> {
  return {} as SQL<unknown>;
}

export async function checkMetadataVersion(
  tx: DrizzleTransactionType,
  table: AnyPgTable & {
    metadataVersion: AnyPgColumn<{ data: number }>;
    id: AnyPgColumn;
  },
  metadataVersion: number,
  id: string,
  filter?: SQL<unknown>
): Promise<boolean>;
export async function checkMetadataVersion(
  tx: DrizzleTransactionType,
  table: AnyPgTable & {
    metadataVersion: AnyPgColumn<{ data: number }>;
    kid: AnyPgColumn;
  },
  metadataVersion: number,
  id: string,
  filter: SQL<unknown>
): Promise<boolean>;
export async function checkMetadataVersion(
  tx: DrizzleTransactionType,
  table:
    | (AnyPgTable & {
        metadataVersion: AnyPgColumn<{ data: number }>;
        id: AnyPgColumn;
      })
    | {
        metadataVersion: AnyPgColumn<{ data: number }>;
        kid: AnyPgColumn;
      },
  metadataVersion: number,
  id: string,
  filter?: SQL<unknown> = eq(table.id, id)
): Promise<boolean> {}

checkMetadataVersion();
