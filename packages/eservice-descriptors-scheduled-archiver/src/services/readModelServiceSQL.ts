/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { match } from "ts-pattern";
import {
  descriptorState,
  unsafeBrandId,
  archivingScope,
  EServiceId,
  DescriptorState,
} from "pagopa-interop-models";
import {
  eserviceDescriptorInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  DrizzleReturnType,
  EServiceDescriptorSQL,
  eserviceDescriptorArchivingScheduleInReadmodelCatalog,
  EServiceDescriptorArchivingScheduleSQL,
} from "pagopa-interop-readmodel-models";
import {
  ArchivableDescriptorRef,
  UnarchivableDescriptor,
  EServicesWithUnarchivableDescriptors,
} from "../models/models.js";

const getArchivingStates = (withArchived: boolean): DescriptorState[] =>
  Object.values(descriptorState).filter((state) =>
    match(state)
      .with(
        descriptorState.archiving,
        descriptorState.archivingSuspended,
        () => true
      )
      .with(descriptorState.archived, () => withArchived)
      .with(
        descriptorState.deprecated,
        descriptorState.published,
        descriptorState.suspended,
        descriptorState.waitingForApproval,
        descriptorState.draft,
        () => false
      )
      .exhaustive()
  );

export function readModelServiceBuilderSQL(readModelDB: DrizzleReturnType) {
  return {
    /**
     * Fetches all archivable descriptor references from the database.
     * A descriptor is considered archivable if it has a state of "archiving" or "archivingSuspended"
     * and its archivableOn date is in the past.
     *
     * @returns The array of archivable descriptor references
     */
    async getArchivableDescriptorRefs(): Promise<ArchivableDescriptorRef[]> {
      const queryResult: {
        descriptor: EServiceDescriptorSQL;
        archivingSchedule: EServiceDescriptorArchivingScheduleSQL;
      }[] = await readModelDB
        .select({
          descriptor: eserviceDescriptorInReadmodelCatalog,
          archivingSchedule:
            eserviceDescriptorArchivingScheduleInReadmodelCatalog,
        })
        .from(eserviceDescriptorInReadmodelCatalog)
        .innerJoin(
          eserviceDescriptorArchivingScheduleInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorArchivingScheduleInReadmodelCatalog.descriptorId
          )
        )
        .where(
          and(
            inArray(
              eserviceDescriptorInReadmodelCatalog.state,
              getArchivingStates(false)
            ),
            lte(
              eserviceDescriptorArchivingScheduleInReadmodelCatalog.archivableOn,
              new Date().toISOString()
            ),
            eq(
              eserviceDescriptorArchivingScheduleInReadmodelCatalog.scope,
              archivingScope.descriptor
            )
          )
        );

      return queryResult.map((row) => ({
        eserviceId: unsafeBrandId(row.descriptor.eserviceId),
        descriptorId: unsafeBrandId(row.descriptor.id),
      }));
    },
    /**
     * Fetches all archivable e-service references from the database.
     * An e-service is considered archivable if its descriptors have a state of "archiving" or "archivingSuspended"
     * and its archivableOn date is in the past.
     *
     * @returns The array of archivable e-service references
     */
    async getArchivableEserviceRefs(): Promise<EServiceId[]> {
      const queryResult: {
        id: string;
      }[] = await readModelDB
        .selectDistinct({
          id: eserviceInReadmodelCatalog.id,
        })
        .from(eserviceInReadmodelCatalog)
        .innerJoin(
          eserviceDescriptorInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceDescriptorInReadmodelCatalog.eserviceId
          )
        )
        .innerJoin(
          eserviceDescriptorArchivingScheduleInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorArchivingScheduleInReadmodelCatalog.descriptorId
          )
        )
        .where(
          and(
            inArray(
              eserviceDescriptorInReadmodelCatalog.state,
              getArchivingStates(false)
            ),
            lte(
              eserviceDescriptorArchivingScheduleInReadmodelCatalog.archivableOn,
              new Date().toISOString()
            ),
            eq(
              eserviceDescriptorArchivingScheduleInReadmodelCatalog.scope,
              archivingScope.eservice
            )
          )
        );
      return queryResult.map((row) => unsafeBrandId(row.id));
    },
    /**
     * This query checks that all the descriptors in a given set of e-services are in the correct state.
     * It checks that the descriptors are in 'archiving', 'archivingSuspended' or 'archived' state and
     * that their archiving scope is 'EService'.
     *
     * @returns The list of e-services with wrong descriptors
     **/
    async getEServiceWithUnarchivableDescriptors(
      eserviceIds: EServiceId[]
    ): Promise<EServicesWithUnarchivableDescriptors> {
      if (eserviceIds.length === 0) {
        return [];
      }
      const queryResult = await readModelDB
        .select({
          eserviceId: eserviceDescriptorInReadmodelCatalog.eserviceId,
          unarchivableDescriptors: sql<UnarchivableDescriptor[]>`
        array_agg(json_build_object(
          'id', ${eserviceDescriptorInReadmodelCatalog.id},
          'state', ${eserviceDescriptorInReadmodelCatalog.state},
          'scope', ${eserviceDescriptorArchivingScheduleInReadmodelCatalog.scope}
        ))
        filter (where ${eserviceDescriptorInReadmodelCatalog.state} not in (${sql.join(
          getArchivingStates(true).map((state) => sql`${state}`),
          sql`, `
        )}))
      `.as("unarchivable_descriptors"),
        })
        .from(eserviceDescriptorInReadmodelCatalog)
        .leftJoin(
          eserviceDescriptorArchivingScheduleInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorArchivingScheduleInReadmodelCatalog.descriptorId
          )
        )
        .where(
          inArray(eserviceDescriptorInReadmodelCatalog.eserviceId, eserviceIds)
        )
        .groupBy(eserviceDescriptorInReadmodelCatalog.eserviceId);

      return EServicesWithUnarchivableDescriptors.parse(queryResult).filter(
        (report) => report.unarchivableDescriptors.length > 0
      );
    },
  };
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
