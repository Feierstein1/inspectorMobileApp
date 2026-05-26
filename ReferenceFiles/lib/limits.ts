// ─── Content / size limits (plan-independent, safe to import in any context) ──
export const LIMITS = {
  // Field / input content
  TEMPLATE_NAME:    200,
  ITEM_LABEL:       200,
  FIELD_NAME:       100,
  TEXT_ANSWER:      500,
  CHOICE_LABEL:     100,

  // Number field absolute bounds
  NUMBER_ABS_MAX:  999_999,
  NUMBER_ABS_MIN: -999_999,

  // Dropdown configuration
  MAX_CHOICES:       100,
  CHOICES_COLLAPSED:  10,

  // Photos (file-level, same for all plans)
  MAX_PHOTO_SIZE_MB:    10,
  MAX_PHOTO_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB

  // Auth
  PASSWORD_MIN:   8,
  PASSWORD_MAX: 128,

  // Client fields
  CLIENT_NAME:    300,
  CLIENT_EMAIL:   254, // RFC 5321 max
  CLIENT_PHONE:    30,
  CLIENT_ADDRESS: 300,
  CLIENT_NOTES:  1000,

  // Client import
  CLIENT_IMPORT_MAX_ROWS:    500,
  CLIENT_IMPORT_MAX_FILE_MB:   5,
  CLIENT_IMPORT_MAX_FILE_BYTES: 5 * 1024 * 1024,
} as const;

// ─── Plan-based resource quotas (server-side only) ────────────────────────────
// null = no limit enforced

export type PlanLimits = {
  MAX_TEMPLATES:               number | null; // templates per account
  MAX_JOBS:                    number | null; // jobs per account
  MAX_EMPLOYEES:               number | null; // workers per account
  MAX_CUSTOM_FIELDS:           number | null; // custom fields per account
  MAX_API_KEYS:                number;        // active API keys per account
  MAX_API_CALLS_PER_DAY:       number | null; // API key calls per day (account-wide)
  MAX_SCHEMA_FIELDS:           number;        // fields per template schema
  MAX_JOB_ITEMS:               number;        // items (assignments) per job
  MAX_PHOTOS_PER_FIELD:        number;        // photos per photo-field per submission
  MAX_SHEET_DOWNLOADS_PER_DAY: number | null; // Excel sheet downloads per day (account-wide)
  AUDIT_LOG_RETENTION_DAYS:    number;        // display-only; no deletion enforced yet
};

const FREE_PLAN_LIMITS: PlanLimits = {
  MAX_TEMPLATES:               5,
  MAX_JOBS:                    20,
  MAX_EMPLOYEES:               10,
  MAX_CUSTOM_FIELDS:           20,
  MAX_API_KEYS:                1,
  MAX_API_CALLS_PER_DAY:       50,
  MAX_SCHEMA_FIELDS:           20,
  MAX_JOB_ITEMS:               10,
  MAX_PHOTOS_PER_FIELD:        10,
  MAX_SHEET_DOWNLOADS_PER_DAY: 10,
  AUDIT_LOG_RETENTION_DAYS:    30,
};

const PRO_PLAN_LIMITS: PlanLimits = {
  MAX_TEMPLATES:               80,
  MAX_JOBS:                    null,
  MAX_EMPLOYEES:               100,
  MAX_CUSTOM_FIELDS:           150,
  MAX_API_KEYS:                10,
  MAX_API_CALLS_PER_DAY:       1_000,
  MAX_SCHEMA_FIELDS:           100,
  MAX_JOB_ITEMS:               50,
  MAX_PHOTOS_PER_FIELD:        30,
  MAX_SHEET_DOWNLOADS_PER_DAY: 500,
  AUDIT_LOG_RETENTION_DAYS:    365,
};

// FREE_TRIAL and EXPIRED are restricted; everything else has full (PRO) access.
const RESTRICTED_PLANS = new Set(["FREE_TRIAL", "EXPIRED"]);

export function getPlanLimits(planType: string): PlanLimits {
  return RESTRICTED_PLANS.has(planType) ? FREE_PLAN_LIMITS : PRO_PLAN_LIMITS;
}

// Convenience: today's UTC midnight as a Date (for daily-reset counters)
export function todayUtcStart(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
