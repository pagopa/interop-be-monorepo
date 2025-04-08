export const AttributeDbtable = {
  attribute: "attribute",
} as const;

export const DeletingDbTable = { deleting_table: "deleting_table" };

export type AttributeDbtable =
  (typeof AttributeDbtable)[keyof typeof AttributeDbtable];

export type DeletingDbTable =
  (typeof DeletingDbTable)[keyof typeof DeletingDbTable];
