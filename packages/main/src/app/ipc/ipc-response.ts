// packages/main/src/app/ipc/ipc-response.ts

export interface IpcResponse<T = void> {
  success: boolean;
  data?: T;
  error?: { message: string; code?: string };
}

export const ipcSuccess = <T>(data?: T): IpcResponse<T> => {
  if (typeof data === 'undefined') {
    return { success: true };
  }
  return { success: true, data };
};

export const ipcFailure = (
  error: unknown,
  fallbackMessage: string,
  code?: string,
): IpcResponse<never> => ({
  success: false,
  error: {
    message: getErrorMessage(error, fallbackMessage),
    ...(code ? { code } : {}),
  },
});

export const getErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error.trim();
  }
  return fallbackMessage;
};

export const assertNonEmptyString = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
};

export const assertOptionalString = (value: unknown, label: string): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string or null.`);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const assertStringArray = (value: unknown, label: string): string[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array of strings.`);
  }
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') {
      throw new Error(`${label} must be an array of strings.`);
    }
    result.push(entry.trim());
  }
  return result;
};

export const assertEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T => {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be one of: ${allowed.join(', ')}.`);
  }
  if (!allowed.includes(value as T)) {
    throw new Error(`${label} must be one of: ${allowed.join(', ')}.`);
  }
  return value as T;
};
