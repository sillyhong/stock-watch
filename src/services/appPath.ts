export const APP_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withAppBasePath(path: string): string {
  if (!path.startsWith("/") || !APP_BASE_PATH || path === APP_BASE_PATH || path.startsWith(`${APP_BASE_PATH}/`)) {
    return path;
  }

  return `${APP_BASE_PATH}${path}`;
}
