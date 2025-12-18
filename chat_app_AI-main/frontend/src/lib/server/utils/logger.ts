// Logger removed from server folder in frontend. Use browser console directly.
export const logger = {
  info: (...args: any[]) => console.log(...args),
  error: (...args: any[]) => console.error(...args),
  warn: (...args: any[]) => console.warn(...args),
  debug: (...args: any[]) => { if (process.env.NODE_ENV === 'development') console.debug(...args); },
};
