/**
 * Ids are generated client-side so an optimistic UI update and the row that the
 * server actually writes share the same identity.
 */
export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
