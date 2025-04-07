export const AttributeDbtable = {
  attribute: "attribute",
} as const;

export const DeletingDbTable = { deleting_by_id_table: "deleting_by_id_table" };

export type AttributeDbtable =
  (typeof AttributeDbtable)[keyof typeof AttributeDbtable];

export type DeletingDbTable =
  (typeof DeletingDbTable)[keyof typeof DeletingDbTable];
