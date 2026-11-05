/**
 * The one Node surface the model tests touch.
 *
 * `@types/node` is not a dependency of this project and a helper that reads a
 * single file is not a reason to make it one. Everything else in `glb.ts` is
 * plain `DataView` and `TextDecoder`, which the standard library already types.
 */
declare module 'node:fs' {
  export function readFileSync(path: string): Uint8Array;
}
