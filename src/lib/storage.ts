const memory = new Map<string, string>();
export const storage = {
  getItem(key: string): string | null {
    try { const value = window.localStorage.getItem(key); if (value !== null) return value; } catch { /* WKWebView file origins may not expose local storage. */ }
    return memory.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    try { window.localStorage.setItem(key, value); } catch { /* Keep this app usable in local-file mode. */ }
    memory.set(key, value);
  },
  removeItem(key: string): void {
    try { window.localStorage.removeItem(key); } catch { /* Memory storage is still cleared below. */ }
    memory.delete(key);
  },
};
