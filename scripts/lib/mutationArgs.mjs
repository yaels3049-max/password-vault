/**
 * Mutation-sweep CLI switches shared by verify scripts (test policy T-1).
 *
 *   (none)                 full sweep (END OF ROUND)
 *   --no-mutations         clean run only
 *   --mutations=M72,M73    clean run + only these mutations
 *
 * A mutation id is the leading token of its label ("M72 new site …" → "M72").
 * Unknown ids and conflicting switches throw, so a typo never turns into a silent skip.
 */

export function parseMutationArgs(argv = process.argv) {
  const none = argv.includes('--no-mutations');
  const listArg = argv.find((a) => a.startsWith('--mutations='));
  if (none && listArg) throw new Error('use either --no-mutations or --mutations=…, not both');
  if (none) return { mode: 'none', ids: null };
  if (listArg) {
    const ids = listArg
      .slice('--mutations='.length)
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (ids.length === 0) throw new Error('--mutations= needs at least one id (e.g. --mutations=M72,M73)');
    return { mode: 'ids', ids: new Set(ids) };
  }
  return { mode: 'all', ids: null };
}

export function mutationId(label) {
  return String(label).split(/\s+/, 1)[0].toUpperCase();
}

/** Filters `mutations` by the parsed switch; `labelOf` returns the label of one entry. */
export function selectMutations(mutations, args, labelOf) {
  if (args.mode === 'none') return [];
  if (args.mode === 'all') return mutations;
  const known = new Set(mutations.map((m) => mutationId(labelOf(m))));
  const unknown = [...args.ids].filter((id) => !known.has(id));
  if (unknown.length) throw new Error(`unknown mutation id(s): ${unknown.join(', ')}`);
  return mutations.filter((m) => args.ids.has(mutationId(labelOf(m))));
}

export function formatElapsed(ms) {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}
