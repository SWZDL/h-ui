/**
 * Byte / time formatting helpers shared by every page.
 * Kept dependency free so they work in the browser and in tests.
 */

export const UNITS = ["Bytes", "KB", "MB", "GB", "TB", "PB"] as const;
const ALL_UNITS = [...UNITS, "EB", "ZB", "YB"] as const;

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === -1) return "Unlimited";
  if (!bytes || bytes <= 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    ALL_UNITS.length - 1
  );

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${ALL_UNITS[i]}`;
}

export function formatStorageCapacity(bytes: number, decimals = 2): number {
  if (!bytes || bytes <= 0) return bytes;
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
}

export function formatStorageUnit(bytes: number): string {
  if (!bytes || bytes <= 0) return "Bytes";
  const k = 1024;
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    ALL_UNITS.length - 1
  );
  return ALL_UNITS[i];
}

export function calculateBytes(value = 0, unit = "Bytes"): number {
  if (value === -1) return -1;
  const index = UNITS.findIndex((item) => item === unit);
  if (index === -1) return value;
  return value * Math.pow(1024, index);
}

/** 1699999999999 -> "2023-11-14 22:13:19" */
export function timestampToDateTime(timestamp?: number | null): string {
  if (!timestamp || timestamp <= 0) return "-";
  const date = new Date(timestamp);
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}`;
}

/** Handles both epoch millis and RFC3339 strings coming from Go. */
export function formatDateTimeValue(value?: number | string | null): string {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "number") return timestampToDateTime(value);
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? String(value) : timestampToDateTime(time);
}

export interface DiffParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

export function timeDifference(timestamp: number): DiffParts {
  const diff = timestamp - Date.now();
  if (!timestamp || diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  const seconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
    expired: false,
  };
}

export const getHourLater = () => Date.now() + 60 * 60 * 1000;
export const getDayLater = () => Date.now() + 24 * 60 * 60 * 1000;
export const getWeekLater = () => Date.now() + 7 * 24 * 60 * 60 * 1000;
export const getMonthLater = () => {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.getTime();
};
export const getYearLater = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.getTime();
};

/** Epoch millis -> value accepted by <input type="datetime-local">. */
export function toDateTimeLocal(timestamp?: number | null): string {
  if (!timestamp || timestamp <= 0) return "";
  const date = new Date(timestamp);
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** <input type="datetime-local"> value -> epoch millis. */
export function fromDateTimeLocal(value: string): number {
  if (!value) return 0;
  const parsed = new Date(value);
  const time = parsed.getTime();
  return Number.isNaN(time) ? 0 : time;
}

/** Human readable duration between now and a future timestamp. */
export function formatRemaining(
  timestamp: number,
  labels: { days: string; hours: string; minutes: string; seconds: string }
): string {
  const parts = timeDifference(timestamp);
  if (parts.expired) return "-";
  const chunks: string[] = [];
  if (parts.days > 0) chunks.push(`${parts.days}${labels.days}`);
  if (parts.hours > 0) chunks.push(`${parts.hours}${labels.hours}`);
  if (parts.minutes > 0) chunks.push(`${parts.minutes}${labels.minutes}`);
  if (parts.seconds > 0) chunks.push(`${parts.seconds}${labels.seconds}`);
  return chunks.join(" ");
}

/** Recursive copy that skips null so server nulls never erase defaults. */
export function assignWith<T>(target: T, source: Partial<T>): void {
  if (source === null || typeof source !== "object") return;

  for (const key of Object.keys(source)) {
    const sourceValue = (source as Record<string, unknown>)[key];
    if (sourceValue === null) continue;

    if (typeof sourceValue === "object") {
      const targetValue = (target as Record<string, unknown>)[key];
      if (!targetValue) {
        (target as Record<string, unknown>)[key] = Array.isArray(sourceValue)
          ? []
          : {};
      }
      assignWith(
        (target as Record<string, unknown>)[key],
        sourceValue as Record<string, unknown>
      );
    } else {
      (target as Record<string, unknown>)[key] = sourceValue;
    }
  }
}

export function deepCopy<T>(source: T): T {
  if (source === null || typeof source !== "object") return source;
  if (Array.isArray(source)) return source.map((item) => deepCopy(item)) as T;

  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    copy[key] = deepCopy((source as Record<string, unknown>)[key]);
  }
  return copy as T;
}

/** Drop undefined / null / "" members from an object (shallow). */
export function compact<T extends Record<string, unknown>>(value: T): T {
  const result = {} as T;
  for (const key of Object.keys(value)) {
    const item = value[key];
    if (item !== undefined && item !== null && item !== "") {
      result[key as keyof T] = item as T[keyof T];
    }
  }
  return result;
}
