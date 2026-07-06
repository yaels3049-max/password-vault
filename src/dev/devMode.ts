/** True when running the Vite dev server (`npm run dev`). Production builds compile this to `false`. */
export function isDevBuild(): boolean {
  return import.meta.env.DEV;
}
