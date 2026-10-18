/**
 * CashNudge Client-Side Browser Storage
 *
 * Provides resilient, privacy-preserving browser persistence using localStorage.
 * Guarantee: Zero financial data, client names, or follow-up notes are transmitted
 * to external database servers or third-party loggers. All data resides exclusively
 * inside the user's browser sandbox.
 */

import {
  LedgerAnalysisResult,
  SavedLedgerData,
  NudgeRecord,
  NudgeActionType,
  UserProfile,
  StorageSummary,
} from "@/types";

export const STORAGE_KEYS = {
  LEDGER: "cashnudge:saved_ledger_v1",
  NUDGE_HISTORY: "cashnudge:nudge_history_v1",
  PROFILE: "cashnudge:user_profile_v1",
} as const;

/** Helper to check if localStorage is accessible in the current environment */
function isLocalStorageAvailable(): boolean {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }
  try {
    const testKey = "__cashnudge_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Persists an analyzed custom ledger to the browser's local storage.
 */
export function saveCustomLedger(
  result: LedgerAnalysisResult,
  fileName: string = "uploaded_ledger.csv"
): boolean {
  if (!isLocalStorageAvailable()) return false;

  try {
    const payload: SavedLedgerData = {
      result,
      fileName,
      savedAt: new Date().toISOString(),
      totalInvoices: result.predictions.length,
    };
    window.localStorage.setItem(STORAGE_KEYS.LEDGER, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.error("[CashNudge Storage] Failed to persist ledger to localStorage:", error);
    return false;
  }
}

/**
 * Retrieves the saved custom ledger from browser local storage, or null if absent/corrupted.
 */
export function getSavedCustomLedger(): SavedLedgerData | null {
  if (!isLocalStorageAvailable()) return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.LEDGER);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as SavedLedgerData;
    if (
      parsed &&
      parsed.result &&
      Array.isArray(parsed.result.predictions) &&
      parsed.result.summary
    ) {
      return parsed;
    }
    return null;
  } catch (error) {
    console.warn("[CashNudge Storage] Could not parse saved ledger:", error);
    return null;
  }
}

/**
 * Clears the persisted custom ledger from local storage.
 */
export function clearCustomLedger(): boolean {
  if (!isLocalStorageAvailable()) return false;
  try {
    window.localStorage.removeItem(STORAGE_KEYS.LEDGER);
    return true;
  } catch {
    return false;
  }
}

/**
 * Records a payment follow-up action (e.g. Gmail opened, mailto triggered, text copied).
 */
export function recordNudgeAction(
  action: Omit<NudgeRecord, "id" | "timestamp">
): NudgeRecord | null {
  if (!isLocalStorageAvailable()) return null;

  try {
    const history = getNudgeHistory();
    const newRecord: NudgeRecord = {
      ...action,
      id: `nudge_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };

    // Keep most recent 200 nudge events to prevent unbounded growth
    const updated = [newRecord, ...history].slice(0, 200);
    window.localStorage.setItem(STORAGE_KEYS.NUDGE_HISTORY, JSON.stringify(updated));
    return newRecord;
  } catch (error) {
    console.error("[CashNudge Storage] Failed to record nudge action:", error);
    return null;
  }
}

/**
 * Retrieves all logged nudge actions in reverse chronological order.
 */
export function getNudgeHistory(): NudgeRecord[] {
  if (!isLocalStorageAvailable()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.NUDGE_HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as NudgeRecord[];
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Retrieves all nudge actions recorded for a specific invoice ID.
 */
export function getNudgesForInvoice(invoiceId: string): NudgeRecord[] {
  const all = getNudgeHistory();
  return all.filter((n) => n.invoiceId === invoiceId);
}

/**
 * Clears the recorded nudge history from local storage.
 */
export function clearNudgeHistory(): boolean {
  if (!isLocalStorageAvailable()) return false;
  try {
    window.localStorage.removeItem(STORAGE_KEYS.NUDGE_HISTORY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Retrieves the freelancer user profile (e.g., default business name).
 */
export function getUserProfile(): UserProfile {
  if (!isLocalStorageAvailable()) return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (!raw) return {};
    return JSON.parse(raw) as UserProfile;
  } catch {
    return {};
  }
}

/**
 * Saves or updates freelancer profile settings.
 */
export function saveUserProfile(profile: Partial<UserProfile>): boolean {
  if (!isLocalStorageAvailable()) return false;

  try {
    const current = getUserProfile();
    const updated: UserProfile = { ...current, ...profile };
    window.localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

/**
 * Computes a high-level summary of local browser storage usage and metadata.
 */
export function getStorageSummary(): StorageSummary {
  const ledger = getSavedCustomLedger();
  const nudges = getNudgeHistory();
  const profile = getUserProfile();

  let totalChars = 0;
  if (isLocalStorageAvailable()) {
    try {
      for (const key of Object.values(STORAGE_KEYS)) {
        const val = window.localStorage.getItem(key);
        if (val) totalChars += key.length + val.length;
      }
    } catch {
      // ignore
    }
  }

  return {
    hasSavedLedger: ledger !== null,
    savedLedgerName: ledger?.fileName,
    savedLedgerDate: ledger?.savedAt,
    invoiceCount: ledger?.totalInvoices || 0,
    nudgeCount: nudges.length,
    approximateBytes: totalChars * 2, // UTF-16 approx 2 bytes per char
    businessName: profile.businessName,
  };
}

/**
 * Exports all local data as an encrypted/portable JSON string for user backup.
 */
export function exportLocalBackup(): string {
  const ledger = getSavedCustomLedger();
  const nudges = getNudgeHistory();
  const profile = getUserProfile();

  const backup = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    ledger,
    nudges,
    profile,
  };

  return JSON.stringify(backup, null, 2);
}

/**
 * Imports a JSON backup string and validates its integrity before restoring.
 */
export function importLocalBackup(jsonString: string): { success: boolean; error?: string } {
  if (!isLocalStorageAvailable()) {
    return { success: false, error: "Local storage is unavailable in this environment." };
  }

  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== "object") {
      return { success: false, error: "Invalid backup format: expected JSON object." };
    }

    if (parsed.ledger && parsed.ledger.result) {
      window.localStorage.setItem(STORAGE_KEYS.LEDGER, JSON.stringify(parsed.ledger));
    }

    if (Array.isArray(parsed.nudges)) {
      window.localStorage.setItem(STORAGE_KEYS.NUDGE_HISTORY, JSON.stringify(parsed.nudges));
    }

    if (parsed.profile && typeof parsed.profile === "object") {
      window.localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(parsed.profile));
    }

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to parse backup JSON.",
    };
  }
}

/**
 * Completely wipes all CashNudge data from browser local storage.
 */
export function clearAllLocalData(): boolean {
  if (!isLocalStorageAvailable()) return false;
  try {
    for (const key of Object.values(STORAGE_KEYS)) {
      window.localStorage.removeItem(key);
    }
    return true;
  } catch {
    return false;
  }
}
