/**
 * D-121-47 — the exact background.js edits (G8 password-surface reveal check), as
 * [new, old] pairs. Reverting them must reproduce the pre-slice bytes, which proves
 * nothing else in background.js changed. Shared by the Phase 121 verifies.
 */
export const D12147_BACKGROUND_EDITS = [
  [
    `          func: function (expectedOrigin) {
            if (String(location.origin || '') !== expectedOrigin) return [];
            if (typeof collectSpecialEligibleCredentialInputs === 'function') {
              return collectSpecialEligibleCredentialInputs();
            }
            return typeof collectSpecialEligibleCredentialLocators === 'function'
              ? collectSpecialEligibleCredentialLocators()
              : [];
          },
          args: [record.frameId === 0 ? allowedOrigin : record.origin],
        },
        function (inputs) {
          var descriptor = specialFrameDescriptorOf(record);
          if (Array.isArray(inputs)) {
            inputs.forEach(function (item) {
              var loc = typeof item === 'string' ? item : item && item.locator;
              if (typeof loc === 'string' && loc) {
                entries.push({
                  key: specialFrameKeyOf(descriptor) + '::' + loc,
                  frame: descriptor,
                  locator: loc,
                  password: Boolean(item && item.password === true),
                });
              }
            });
          }
`,
    `          func: function (expectedOrigin) {
            if (String(location.origin || '') !== expectedOrigin) return [];
            return typeof collectSpecialEligibleCredentialLocators === 'function'
              ? collectSpecialEligibleCredentialLocators()
              : [];
          },
          args: [record.frameId === 0 ? allowedOrigin : record.origin],
        },
        function (locators) {
          var descriptor = specialFrameDescriptorOf(record);
          if (Array.isArray(locators)) {
            locators.forEach(function (loc) {
              if (typeof loc === 'string' && loc) {
                entries.push({ key: specialFrameKeyOf(descriptor) + '::' + loc, frame: descriptor, locator: loc });
              }
            });
          }
`,
  ],
  [
    `  var readinessMode = message.readinessMode === 'declared' ? 'declared' : 'reveal';
  // D-121-47 (G8): single-step floating authoring tests only; declared mode never.
  var requirePasswordSurface =
    readinessMode === 'reveal' && message.requirePasswordSurface === true;
`,
    `  var readinessMode = message.readinessMode === 'declared' ? 'declared' : 'reveal';
`,
  ],
  [
    `      var sawFreshNonPassword = false;
      function pollReveal(before, deadline) {
        collectSpecialRevealSnapshot(tabId, allowedOrigin, function (snap) {
          if (!snap.ok) {
            reply({ ok: false, reason: snap.reason });
            return;
          }
          var freshAll = snap.entries.filter(function (e) {
            return !before[e.key];
          });
          if (freshAll.some(function (e) { return e.password !== true; })) sawFreshNonPassword = true;
          var fresh = freshAll.filter(function (e) {
            return !requirePasswordSurface || e.password === true;
          })[0];
          if (fresh) {
            reply({
              ok: true,
              revealed: { frameKey: specialFrameKeyOf(fresh.frame), frame: fresh.frame },
            });
            return;
          }
          if (Date.now() >= deadline) {
            if (sawFreshNonPassword) {
              reply({ ok: false, reason: 'surface_not_login' });
              return;
            }
            reply({ ok: false, reason: 'surface_not_revealed' });
            return;
          }
`,
    `      function pollReveal(before, deadline) {
        collectSpecialRevealSnapshot(tabId, allowedOrigin, function (snap) {
          if (!snap.ok) {
            reply({ ok: false, reason: snap.reason });
            return;
          }
          var fresh = snap.entries.filter(function (e) {
            return !before[e.key];
          })[0];
          if (fresh) {
            reply({
              ok: true,
              revealed: { frameKey: specialFrameKeyOf(fresh.frame), frame: fresh.frame },
            });
            return;
          }
          if (Date.now() >= deadline) {
            reply({ ok: false, reason: 'surface_not_revealed' });
            return;
          }
`,
  ],
];

/** Revert the D-121-47 edits; throws unless each edit is present exactly once. */
export function revertD12147BackgroundEdits(src) {
  let out = src;
  for (const [next, prev] of D12147_BACKGROUND_EDITS) {
    const n = out.split(next).length - 1;
    if (n !== 1) throw new Error(`D-121-47 background edit present ${n}× (expected 1): ${next.slice(0, 80)}`);
    out = out.replace(next, () => prev);
  }
  return out;
}
