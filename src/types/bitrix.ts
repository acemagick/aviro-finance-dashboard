/**
 * Raw shapes as returned by the Bitrix24 REST API.
 * Bitrix24 sends most numbers and IDs as strings, so we keep them as
 * strings here and convert them in `services/bitrixMappers.ts`.
 */

/** P = in progress, S = success (e.g. "Close deal"), F = failure (lost). */
export type BitrixStageSemantic = 'P' | 'S' | 'F';

/** Custom deal fields always start with UF_CRM_. */
export type BitrixCustomFieldCode = `UF_CRM_${string}`;

/** Subset of fields from `crm.deal.list`, plus AVIRO custom fields. */
export interface BitrixDeal {
  /** Deal ID, e.g. "13088". */
  ID: string;
  /** Deal Name, e.g. "Simple Park Co-op Society". */
  TITLE: string;
  /** Deal Amount, e.g. "1148364.00". This is the income source. */
  OPPORTUNITY: string;
  CURRENCY_ID: string;
  /** Pipeline ID. "0" is the default pipeline. */
  CATEGORY_ID: string;
  /** Current stage code, e.g. "NEW" or "UC_DESIGN". */
  STAGE_ID: string;
  STAGE_SEMANTIC_ID: BitrixStageSemantic;
  /** Responsible Person (user ID). */
  ASSIGNED_BY_ID: string;
  /** Start Date. ISO 8601, e.g. "2026-09-11T00:00:00+05:30". */
  BEGINDATE: string;
  DATE_CREATE: string;
  /**
   * AVIRO custom fields (Site Name, Project Type, ...). Multiple fields come
   * as arrays; list fields hold option IDs (see `BitrixFieldOptions`).
   */
  [customField: BitrixCustomFieldCode]: BitrixFieldValue;
}

/** A raw custom field value as Bitrix24 sends it. */
export type BitrixFieldValue = string | number | boolean | null | undefined | ReadonlyArray<string | number>;

/** Subset of fields from `user.get`. */
export interface BitrixUser {
  ID: string;
  NAME: string | null;
  LAST_NAME: string | null;
  /** Can be missing (e.g. for extranet users). */
  UF_DEPARTMENT?: number[];
  ACTIVE: boolean;
}

/** Subset of fields from `department.get`. */
export interface BitrixDepartment {
  ID: string;
  NAME: string;
  PARENT?: string;
}

/** Item from `crm.category.list` (entityTypeId = 2 for deals). */
export interface BitrixDealCategory {
  id: number;
  name: string;
  sort: number;
  isDefault: 'Y' | 'N';
}

/** Deal stage from `crm.status.list` (ENTITY_ID "DEAL_STAGE" or "DEAL_STAGE_<pipelineId>"). */
export interface BitrixDealStage {
  ENTITY_ID: string;
  STATUS_ID: string;
  NAME: string;
  SORT: string;
  CATEGORY_ID: string;
}

/**
 * Item from `crm.item.list` for the "Expenses" smart process (entityTypeId 1048).
 * Smart process fields use camelCase codes, e.g. `ufCrm12_1790320689`.
 */
export interface BitrixExpenseItem {
  id: number;
  /** Name. */
  title: string | null;
  /** Responsible person (user ID). */
  assignedById: number | null;
  /** Created on. ISO 8601. Only used when the Expense Date field is blank. */
  createdTime: string | null;
  /** Custom fields (amount, category, deal link, employee, department, site name, expense date). */
  [customField: `ufCrm${string}`]: BitrixFieldValue;
}

/**
 * Item from `crm.item.list` for the "Essentials only" smart process (entityTypeId 1040).
 * Only the fields the server selects (see ESSENTIALS_FIELDS in server/index.js).
 */
export interface BitrixEssentialsItem {
  id: number;
  title: string | null;
  /** Record-level Responsible person (Bitrix24 user ID). */
  assignedById?: number | null;
  /** Stage ID, e.g. "DT1040_14:SUCCESS". */
  stageId: string | null;
  /** Created on. ISO 8601. */
  createdTime: string | null;
  /** "Deal" relation: the deal ID, or 0/null when not linked. */
  parentId2?: number | string | null;
  /** Category, amounts, dates and site fields. */
  [customField: `ufCrm${string}`]: BitrixFieldValue;
}

/** Served by `/api/field-options`: text for list-field option IDs. */
export interface BitrixFieldOptions {
  /** "Essentials only" Category options, in Bitrix24 order. */
  essentialsCategories: Array<{ id: string; label: string }>;
  /** "Essentials only" stages whose Bitrix24 semantics is failure ("F"). */
  essentialsFailedStageIds: string[];
  /** Other "Essentials only" list fields (employee, departments): { fieldCode: { optionId: text } }. */
  essentials: Record<string, Record<string, string>>;
  /** Deal list fields: { fieldCode: { optionId: text } }. */
  deal: Record<string, Record<string, string>>;
  /** Expense list fields: { fieldCode: { optionId: text } }. */
  expense: Record<string, Record<string, string>>;
  /** CRM entity types the expense "Deal / Project" field may link to, e.g. ["DEAL"]. */
  expenseDealLinkTypes: string[];
}
