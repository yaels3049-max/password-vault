/**
 * Phase 120.2 — Admin Hub console assist for S3–S7 / P3 capture (Shufersal ONLY).
 * Paste on Vite Admin Hub while logged in as Admin.
 *
 * Modes (set MODE below before paste, or call helpers after load):
 *   status  — dump live row + Managed profile redacted (default)
 *   s3      — set credentialMode=credential_fields preserving live login_fields
 *             (username, password ONLY — no schema rewrite)
 *
 * S4–S7 (Analyze / Visual Mapping / save / validate / activate) remain Admin UI +
 * extension — this script does NOT invent CSS locators and does NOT activate validated.
 *
 * Forbidden: username→email; builtinCatalog edits; adapter_id rewrite; runtime code.
 */
(async function operatorAssistS3S7Shufersal() {
  const MODE = 'status'; // 'status' | 's3'
  const SERVICE_ID = 'shufersal';
  const REQUIRED_FIELD_IDS = ['username', 'password'];

  function fieldIds(loginFields) {
    if (!Array.isArray(loginFields)) return [];
    return loginFields
      .map((f) => (f && typeof f.id === 'string' ? f.id : null))
      .filter(Boolean);
  }

  function redact(row) {
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const profile =
      meta.autofillProfile && typeof meta.autofillProfile === 'object'
        ? meta.autofillProfile
        : null;
    const mappings = Array.isArray(profile?.fieldMappings)
      ? profile.fieldMappings.map((m) => ({
          fieldId: m.fieldId,
          locatorType: m.locatorType,
          locator: m.locator,
        }))
      : [];
    return {
      id: row.id,
      login_url: row.login_url,
      login_fields_ids: fieldIds(row.login_fields),
      adapter_id: row.adapter_id ?? null,
      adapter_id_none: row.adapter_id == null || row.adapter_id === '',
      credentialMode: meta.credentialMode ?? null,
      autofillProfile: profile
        ? {
            supportState: profile.supportState ?? null,
            configVersion: profile.configVersion ?? null,
            loginEntryUrl: profile.loginEntryUrl ?? null,
            allowedOrigin: profile.allowedOrigin ?? null,
            fieldMappings: mappings,
            validationMetadataVersion: profile.validation?.metadataVersion ?? null,
          }
        : null,
    };
  }

  function assertLiveSchema(ids) {
    const ok =
      ids.length === 2 &&
      ids[0] === 'username' &&
      ids[1] === 'password';
    return ok;
  }

  const api = await import('/src/admin/adminRegistryApi.ts');

  async function dumpStatus(label) {
    const row = await api.fetchRegistryRowForAdmin(SERVICE_ID);
    if (!row) {
      console.log(JSON.stringify({ status: 'MISSING_ROW', label }, null, 2));
      return null;
    }
    const live = redact(row);
    const schemaOk = assertLiveSchema(live.login_fields_ids);
    const out = {
      status: schemaOk ? 'OK' : 'STOP_SCHEMA',
      label,
      live,
      requiredFieldIds: REQUIRED_FIELD_IDS,
      s3Ready: schemaOk && live.adapter_id_none,
      s7Done:
        live.autofillProfile?.supportState === 'validated' &&
        Array.isArray(live.autofillProfile?.fieldMappings) &&
        live.autofillProfile.fieldMappings.some((m) => m.fieldId === 'username') &&
        live.autofillProfile.fieldMappings.some((m) => m.fieldId === 'password'),
      adminUiNext: [
        'S4: Autofill editor → Analyze Login Page (readiness) on Login Entry',
        'S5: Map username + password only (Analyze HIGH and/or Visual Mapping)',
        'S6: Save mapping (structural only)',
        'S7: Live validate + explicit activate validated',
        'Then re-paste this script with MODE=status for P3 capture',
      ],
      forbidden: [
        'Do not map email',
        'Do not rename username→email',
        'Do not rewrite adapter_id',
        'Do not change builtinCatalog',
      ],
    };
    console.log('=== PHASE120 S3–S7 / P3 STATUS ===');
    console.log(JSON.stringify(out, null, 2));
    return out;
  }

  if (MODE === 's3') {
    const before = await api.fetchRegistryRowForAdmin(SERVICE_ID);
    if (!before) {
      console.log(JSON.stringify({ status: 'MISSING_ROW', step: 's3' }, null, 2));
      return;
    }
    const ids = fieldIds(before.login_fields);
    if (!assertLiveSchema(ids)) {
      console.log(
        JSON.stringify(
          {
            status: 'STOP_SCHEMA',
            step: 's3',
            login_fields_ids: ids,
            hint: 'Live schema must be username,password only. Do not rewrite.',
          },
          null,
          2,
        ),
      );
      return;
    }
    // Preserve exact live login_fields objects; set credential_fields mode only.
    await api.updateGlobalRegistryRow(SERVICE_ID, {
      credential_mode: 'credential_fields',
      login_fields: before.login_fields,
    });
    console.log(JSON.stringify({ status: 'S3_APPLIED', credential_mode: 'credential_fields' }, null, 2));
    await dumpStatus('after_s3');
    return;
  }

  await dumpStatus('status');
})();
