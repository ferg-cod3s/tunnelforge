export interface SessionFormData {
  workingDir: string;
  command: string;
  spawnWindow: boolean;
  titleMode: string;
}

const STORAGE_KEYS = {
  SESSION_FORM: 'session-form-data',
  SPAWN_WINDOW: 'SPAWN_WINDOW',
} as const;

export function getSessionFormValue(key: string): any {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SESSION_FORM);
    if (data) {
      const parsed = JSON.parse(data);
      return parsed[key];
    }
  } catch (error) {
    console.error('Failed to get session form value:', error);
  }
  return null;
}

export function setSessionFormValue(key: string, value: any): void {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SESSION_FORM);
    const parsed = data ? JSON.parse(data) : {};
    parsed[key] = value;
    localStorage.setItem(STORAGE_KEYS.SESSION_FORM, JSON.stringify(parsed));
  } catch (error) {
    console.error('Failed to set session form value:', error);
  }
}

export function removeSessionFormValue(key: string): void {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SESSION_FORM);
    if (data) {
      const parsed = JSON.parse(data);
      delete parsed[key];
      localStorage.setItem(STORAGE_KEYS.SESSION_FORM, JSON.stringify(parsed));
    }
  } catch (error) {
    console.error('Failed to remove session form value:', error);
  }
}

export function loadSessionFormData(): SessionFormData {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SESSION_FORM);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load session form data:', error);
  }

  // Return defaults
  return {
    workingDir: '',
    command: 'zsh',
    spawnWindow: false,
    titleMode: 'dynamic',
  };
}

export function saveSessionFormData(data: Partial<SessionFormData>): void {
  try {
    const existing = loadSessionFormData();
    const updated = { ...existing, ...data };
    localStorage.setItem(STORAGE_KEYS.SESSION_FORM, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save session form data:', error);
  }
}