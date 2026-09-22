/**
 * Phase 120.2 S1 — Admin Hub console (logged-in Admin, Vite DEV).
 * Calls fetchRegistryRowForAdmin('shufersal'). Compares to LIVE baseline
 * (Architecture 2026-09-21): username + password — NOT builtin seed email.
 * No token clipboard. No RLS/service-role. No secrets printed.
 */
(async function operatorAssistS1ShufersalViaAdminHub() {
  const LIVE_BASELINE = {
    id: 'shufersal',
    primary_url: 'https://www.shufersal.co.il',
    login_url: 'https://www.shufersal.co.il/online/he/login',
    login_field_ids: ['username', 'password'],
    adapter_id_none: true,
  };

  function fieldIds(loginFields) {
    if (!Array.isArray(loginFields)) return [];
    return loginFields
      .map((f) => (f && typeof f.id === 'string' ? f.id : null))
      .filter(Boolean);
  }

  function adapterIsNone(adapterId) {
    return adapterId == null || adapterId === '';
  }

  function norm(u) {
    return typeof u === 'string' ? u.trim().replace(/\/$/, '') : '';
  }

  function redactLive(row) {
    const meta =
      row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const profile =
      meta.autofillProfile && typeof meta.autofillProfile === 'object'
        ? meta.autofillProfile
        : null;
    return {
      id: row.id,
      credentialMode: meta.credentialMode ?? null,
      login_fields_ids: fieldIds(row.login_fields),
      login_url: row.login_url ?? null,
      adapter_id: row.adapter_id ?? null,
      adapter_id_none: adapterIsNone(row.adapter_id),
      autofillProfile_supportState: profile ? profile.supportState ?? null : null,
      primary_url: row.primary_url ?? null,
      owner_user_id: row.owner_user_id ?? null,
      global_row: row.owner_user_id == null,
    };
  }

  function compareToLiveBaseline(live) {
    const mismatches = [];
    if (live.id !== LIVE_BASELINE.id) mismatches.push('id');
    if (norm(live.primary_url) !== norm(LIVE_BASELINE.primary_url)) {
      mismatches.push('primary_url');
    }
    if (norm(live.login_url) !== norm(LIVE_BASELINE.login_url)) {
      mismatches.push('login_url');
    }
    if (
      JSON.stringify(live.login_fields_ids) !==
      JSON.stringify(LIVE_BASELINE.login_field_ids)
    ) {
      mismatches.push('login_fields');
    }
    if (!live.adapter_id_none) mismatches.push('adapter_id');
    return mismatches;
  }

  try {
    const api = await import('/src/admin/adminRegistryApi.ts');
    const row = await api.fetchRegistryRowForAdmin('shufersal');
    if (!row) {
      console.log(JSON.stringify({ status: 'MISSING_ROW', path: 'fetchRegistryRowForAdmin' }, null, 2));
      return;
    }
    const live = redactLive(row);
    const mismatches = compareToLiveBaseline(live);
    const out = {
      status: mismatches.length === 0 ? 'MATCH' : 'MISMATCH',
      path: 'fetchRegistryRowForAdmin',
      live,
      liveBaseline: LIVE_BASELINE,
      mismatches,
      gate:
        mismatches.length === 0
          ? 'S1_PASS_NEXT_ADMIN_S3_S7'
          : 'STOP_ARCHITECTURE',
      note: 'Paste this JSON to Developer. Do not paste tokens. Do not rewrite adapter_id.',
    };
    console.log('=== PHASE120 S1 REDACTED DUMP ===');
    console.log(JSON.stringify(out, null, 2));
    return out;
  } catch (err) {
    console.log(
      JSON.stringify(
        {
          status: 'HUB_API_PATH_FAILED',
          error: err instanceof Error ? err.message : String(err),
          hint: 'Use Vite Admin Hub logged in; paste on Admin page.',
        },
        null,
        2,
      ),
    );
  }
})();
