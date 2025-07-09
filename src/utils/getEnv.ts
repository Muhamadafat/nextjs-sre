export function getEnv(key: string): string | undefined {
  if (typeof window !== 'undefined') {
    // Client-side: use NEXT_PUBLIC_ prefixed variables
    return process.env[`NEXT_PUBLIC_${key}`];
  } else {
    // Server-side: use process.env directly
    return process.env[key];
  }
}