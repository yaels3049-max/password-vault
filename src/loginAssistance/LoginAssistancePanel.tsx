import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { AccessProfile } from '../profile';
import { profilesForService } from '../profile';
import { hasCompleteCredentials, type Credential } from '../credentials';
import { appContextActions, initialActiveProfile, isUserCustomApp } from '../digitalHome/appContext';
import { hiddenCredentialFieldIds } from '../digitalHome/ownSiteDefinition';
import type { Service } from '../mockServices';
import { isFieldMasked, resolveCredentialEntry } from '../service/credentialSchema';
import {
  attemptExistingAutomaticCompletion,
  openAssistanceUrl,
} from './assistanceActions';
import { launchKindOffersProfileUi, resolveDigitalHomeLaunchKind } from './credentialsGate';
import { copyCredentialField } from './copyField';
import {
  computeFloatingPanelPosition,
  type FloatingPanelCoords,
} from './floatingPosition';
import { IconClose, IconCopy, IconEye } from './icons';
import {
  allowsAutomaticCompletionAttempt,
  resolveLoginAssistanceLevel,
} from './supportLevel';
import {
  LABEL_ASSISTANCE,
  LABEL_ADD_FIRST_PROFILE,
  LABEL_ADD_PROFILE,
  LABEL_APP_ACTIONS,
  LABEL_CLOSE,
  LABEL_COMPLETE_CREDENTIALS,
  LABEL_COPY,
  LABEL_EDIT_PROFILE,
  LABEL_EDIT_SITE_DETAILS,
  LABEL_HIDE_PASSWORD,
  LABEL_REMOVE_APP,
  LABEL_OPEN_SITE,
  LABEL_SHOW_PASSWORD,
  LABEL_TRY_AUTO,
  MSG_COPIED,
  MSG_COPY_FAILED,
  MSG_LOGIN_FIELDS_UPDATED,
  MSG_MANUAL_ONLY,
  MSG_MISSING_USER_CREDENTIALS_LAUNCH,
  MSG_NO_PROFILES,
  MSG_NO_STORED_CREDENTIALS_LAUNCH,
  MSG_NOT_CONFIGURED_LAUNCH,
} from './messages';
import {
  MSG_MANAGED_IN_PROGRESS,
  isManagedAutofillInFlightFor,
  serviceClaimsValidatedManagedProfile,
} from '../execution/managedAutofill';

const COPY_CONFIRM_MS = 2200;
const STATUS_MS = 8000;

type PanelStatus = { message: string; failure: boolean };

export interface LoginAssistancePanelProps {
  service: Service;
  accessProfiles: AccessProfile[];
  credentialsByProfileId: Record<string, Credential>;
  /** Viewport rect of the clicked tile (D-113-15 anchor). */
  anchorRect: DOMRect;
  /** Same logo URL as the Home tile (when resolved). */
  logoSrc?: string | null;
  onClose: () => void;
  /** App is in the vault `customServices` (AD-123-14). */
  isCustom?: boolean;
  /** D-123-8 — own site following its approved registry entry (fields may have changed). */
  ownSiteApproved?: boolean;
  /** «עריכת פרופיל» — open the profile host on this profile (AD-123-3). */
  onEditProfile?: (service: Service, profileId: string) => void;
  /** «הוספת פרופיל» / «הוסף פרופיל» — open the profile host in add mode. */
  onAddProfile?: (service: Service) => void;
  /** App-actions menu «עריכת פרטי האתר» — user-created custom sites only (AD-123-14). */
  onEditSiteDetails?: (service: Service) => void;
  /** App-actions menu «הסרת אפליקציה» — every app (AD-123-11). */
  onRemoveApp?: (service: Service) => void;
}

export default function LoginAssistancePanel({
  service,
  accessProfiles,
  credentialsByProfileId,
  anchorRect,
  logoSrc = null,
  onClose,
  isCustom = false,
  ownSiteApproved = false,
  onEditProfile,
  onAddProfile,
  onEditSiteDetails,
  onRemoveApp,
}: LoginAssistancePanelProps) {
  const profiles = profilesForService(accessProfiles, service.id);
  const level = resolveLoginAssistanceLevel(service);
  const allowAuto = allowsAutomaticCompletionAttempt(level);
  const launchKind = resolveDigitalHomeLaunchKind(
    service,
    accessProfiles,
    credentialsByProfileId,
  );
  const entry = resolveCredentialEntry(service);
  const loginFields = launchKind === 'credentials' && entry.kind === 'form' ? entry.fields : [];
  const showCredentialUi = launchKind === 'credentials';
  const profileUi = launchKindOffersProfileUi(launchKind);
  const actions = appContextActions(service, profiles, isUserCustomApp(service, isCustom));
  const showProfileChips = profileUi && actions.switcher;
  const showEmptyState = profileUi && actions.empty_state;
  // AD-123-17: the app-actions menu depends only on its entries — never on the launch kind / profile UI.
  const showEditSiteDetails = actions.menu.edit_site_details && Boolean(onEditSiteDetails);
  const showRemoveApp = actions.menu.remove_app && Boolean(onRemoveApp);
  const showAppMenu = showEditSiteDetails || showRemoveApp;
  const profileIdsKey = profiles.map((profile) => profile.id).join('|');

  const panelRef = useRef<HTMLElement | null>(null);
  const appMenuRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<FloatingPanelCoords>(() =>
    computeFloatingPanelPosition(anchorRect),
  );

  // AD-123-7: every open starts on the default; switching is local to this open window.
  const [activeProfileId, setActiveProfileId] = useState<string | null>(() =>
    initialActiveProfile(profiles),
  );
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [copyFlashFieldId, setCopyFlashFieldId] = useState<string | null>(null);
  const [autoBusyProfileId, setAutoBusyProfileId] = useState<string | null>(null);

  const [panelStatus, setPanelStatus] = useState<PanelStatus | null>(null);
  const [failureFlash, setFailureFlash] = useState(0);
  const [logoFailed, setLogoFailed] = useState(false);
  const [appMenuOpen, setAppMenuOpen] = useState(false);

  // Another tile opened while the window is open = a new open.
  useEffect(() => {
    setActiveProfileId(initialActiveProfile(profilesForService(accessProfiles, service.id)));
    setPasswordVisible(false);
    setCopyFlashFieldId(null);
    setPanelStatus(null);
    setFailureFlash(0);
    setLogoFailed(false);
    setAppMenuOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset per service only
  }, [service.id]);

  // Profiles changed while open: keep the active profile while it still exists.
  useEffect(() => {
    setActiveProfileId((current) =>
      current && profiles.some((profile) => profile.id === current)
        ? current
        : initialActiveProfile(profiles),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the profile id set
  }, [profileIdsKey]);

  useEffect(() => {
    setLogoFailed(false);
  }, [logoSrc]);

  const activeCredential: Credential =
    (activeProfileId && credentialsByProfileId[activeProfileId]) || {};
  // D-123-8: own sites only; values under other field ids stay in the vault until the profile is saved.
  const showFieldsUpdated =
    isCustom &&
    ownSiteApproved &&
    profileUi &&
    activeProfileId !== null &&
    entry.kind === 'form' &&
    hiddenCredentialFieldIds(activeCredential, entry.fields.map((field) => field.id)).length > 0;
  // O-123-26: same building blocks as the tile dot (O-123-25); no-stored-credentials counts as complete.
  const activeProfileComplete =
    entry.kind === 'no-stored-credentials' ||
    (entry.kind === 'form' &&
      activeProfileId !== null &&
      hasCompleteCredentials(credentialsByProfileId[activeProfileId], entry.fields));

  useLayoutEffect(() => {
    function liveAnchor(): DOMRect {
      const tile = document.querySelector(
        `[data-service-tile][data-service-id="${CSS.escape(service.id)}"]`,
      );
      if (tile instanceof HTMLElement) {
        return tile.getBoundingClientRect();
      }
      return anchorRect;
    }

    function reposition() {
      const height = panelRef.current?.offsetHeight;
      setCoords(
        computeFloatingPanelPosition(liveAnchor(), {
          panelHeight: height,
        }),
      );
    }
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [anchorRect, service.id, showProfileChips, showEmptyState, panelStatus, passwordVisible, launchKind, appMenuOpen, showFieldsUpdated]);

  // Close on Escape; click-outside closes without blocking copy/open.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target || !panelRef.current) return;
      if (panelRef.current.contains(target)) return;
      // Keep clicks on the assisted tile from immediately re-open flickering.
      const wrap = (target as Element).closest?.('[data-service-tile]');
      if (wrap?.getAttribute('data-service-id') === service.id) return;
      onClose();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [onClose, service.id]);

  function showPanelStatus(message: string) {
    const next: PanelStatus = { message, failure: false };
    setPanelStatus(next);
    window.setTimeout(() => {
      setPanelStatus((current) => (current === next ? null : current));
    }, STATUS_MS);
  }

  // A failure stays until the next action in this window or its close.
  function showPanelFailure(message: string) {
    setPanelStatus({ message, failure: true });
    setFailureFlash((n) => n + 1);
  }

  function handleWindowClickCapture(event: ReactMouseEvent<HTMLElement>) {
    const target = event.target as Element;
    if (appMenuOpen && !appMenuRef.current?.contains(target)) {
      setAppMenuOpen(false);
    }
    if (panelStatus?.failure && target.closest('button')) {
      setPanelStatus(null);
    }
  }

  function selectProfile(profileId: string) {
    setActiveProfileId(profileId);
    setPasswordVisible(false);
    setCopyFlashFieldId(null);
  }

  function handleOpenSite() {
    const result = openAssistanceUrl(service);
    if (result.status === 'unavailable') {
      showPanelFailure(result.message);
      return;
    }
    showPanelStatus(result.message);
  }

  async function handleCopy(fieldId: string, value: string) {
    const outcome = await copyCredentialField(value);
    if (outcome === 'ok') {
      setCopyFlashFieldId(fieldId);
      window.setTimeout(() => {
        setCopyFlashFieldId((current) => (current === fieldId ? null : current));
      }, COPY_CONFIRM_MS);
      return;
    }
    showPanelFailure(MSG_COPY_FAILED);
  }

  async function handleTryAuto() {
    if (!allowAuto) {
      showPanelStatus(MSG_MANUAL_ONLY);
      return;
    }
    if (!activeProfileId) {
      return;
    }
    // AC-117-36 — block duplicate for this (service, profile) only; other profiles OK.
    if (
      autoBusyProfileId === activeProfileId ||
      isManagedAutofillInFlightFor(service.id, activeProfileId)
    ) {
      return;
    }
    const runningProfileId = activeProfileId;
    setAutoBusyProfileId(runningProfileId);
    const managedClaim = serviceClaimsValidatedManagedProfile(service);
    // D-117-18 — in-progress scoped to this execution only.
    if (managedClaim) {
      showPanelStatus(MSG_MANAGED_IN_PROGRESS);
    }
    try {
      const result = await attemptExistingAutomaticCompletion(
        service,
        runningProfileId,
        credentialsByProfileId,
      );
      if (result.outcome === 'success' || result.outcome === 'opened') {
        showPanelStatus(result.message);
      } else {
        showPanelFailure(result.message);
      }
    } finally {
      setAutoBusyProfileId((current) =>
        current === runningProfileId ? null : current,
      );
    }
  }

  return (
    <section
      ref={panelRef}
      className={`la-panel la-panel--float la-panel--side-${coords.side}`}
      aria-label={LABEL_ASSISTANCE}
      data-login-assistance="true"
      data-support-level={level}
      data-launch-kind={launchKind}
      data-floating="true"
      tabIndex={-1}
      style={{
        top: coords.top,
        left: coords.left,
        width: coords.width,
        maxHeight: coords.maxHeight,
      }}
      onClickCapture={handleWindowClickCapture}
    >
      {failureFlash > 0 && <span key={failureFlash} className="la-panel-failure-flash" aria-hidden="true" />}
      <header className="la-panel-header">
        <div className="la-panel-heading">
          <h2 className="la-panel-title">
            {typeof logoSrc === 'string' && !logoFailed ? (
              <img
                className="la-service-icon la-service-icon--img"
                src={logoSrc}
                alt=""
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <span className="la-service-icon la-service-icon--emoji" aria-hidden="true">
                {service.icon || '🔗'}
              </span>
            )}
            <span className="la-panel-title-text">{service.name}</span>
          </h2>
        </div>
        {showAppMenu && (
          <div className="la-app-menu" data-app-menu="true" ref={appMenuRef}>
            <button
              type="button"
              className="la-icon-btn la-app-menu-btn"
              aria-label={LABEL_APP_ACTIONS}
              title={LABEL_APP_ACTIONS}
              aria-haspopup="menu"
              aria-expanded={appMenuOpen}
              onClick={() => setAppMenuOpen((open) => !open)}
            >
              ⋮
            </button>
            {appMenuOpen && (
              <div className="la-app-menu-list" role="menu" aria-label={LABEL_APP_ACTIONS}>
                {showEditSiteDetails && onEditSiteDetails && (
                  <button
                    type="button"
                    role="menuitem"
                    className="la-app-menu-item"
                    data-action="edit-site-details"
                    onClick={() => {
                      setAppMenuOpen(false);
                      onEditSiteDetails(service);
                    }}
                  >
                    {LABEL_EDIT_SITE_DETAILS}
                  </button>
                )}
                {showRemoveApp && onRemoveApp && (
                  <button
                    type="button"
                    role="menuitem"
                    className="la-app-menu-item la-app-menu-item--danger"
                    data-action="remove-app"
                    onClick={() => {
                      setAppMenuOpen(false);
                      onRemoveApp(service);
                    }}
                  >
                    {LABEL_REMOVE_APP}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          className="la-icon-btn la-close-btn"
          onClick={onClose}
          aria-label={LABEL_CLOSE}
          title={LABEL_CLOSE}
        >
          <IconClose />
        </button>
      </header>

      {!allowAuto && showCredentialUi && (
        <p className="la-manual-hint" role="status">
          {MSG_MANUAL_ONLY}
        </p>
      )}

      {showProfileChips && (
        <div className="la-profiles" role="listbox" aria-label="פרופילים">
          {profiles.map((profile) => {
            const active = profile.id === activeProfileId;
            return (
              <button
                key={profile.id}
                type="button"
                role="option"
                aria-selected={active}
                className={`la-profile-chip${active ? ' la-profile-chip--active' : ''}`}
                onClick={() => selectProfile(profile.id)}
              >
                {profile.displayName}
              </button>
            );
          })}
        </div>
      )}

      {showFieldsUpdated && (
        <div className="la-fields-updated" role="status" data-notice="login-fields-updated">
          <p className="la-empty la-empty--notice">{MSG_LOGIN_FIELDS_UPDATED}</p>
          {onEditProfile && activeProfileId && (
            <button
              type="button"
              className="la-secondary-btn"
              data-action="edit-profile"
              onClick={() => onEditProfile(service, activeProfileId)}
            >
              {LABEL_EDIT_PROFILE}
            </button>
          )}
        </div>
      )}

      {launchKind === 'not-configured' ? (
        <div className="la-fields" role="status">
          <p className="la-empty la-empty--notice">{MSG_NOT_CONFIGURED_LAUNCH}</p>
        </div>
      ) : launchKind === 'no-stored-credentials' ? (
        <div className="la-fields" role="status">
          <p className="la-empty la-empty--notice">{MSG_NO_STORED_CREDENTIALS_LAUNCH}</p>
        </div>
      ) : showEmptyState ? (
        <div className="la-fields la-empty-state" data-app-context="empty-state">
          <p className="la-empty la-empty--notice" role="status">
            {MSG_NO_PROFILES}
          </p>
          {onAddProfile && (
            <button
              type="button"
              className="la-secondary-btn"
              data-action="add-first-profile"
              onClick={() => onAddProfile(service)}
            >
              {LABEL_ADD_FIRST_PROFILE}
            </button>
          )}
        </div>
      ) : launchKind === 'missing-user-credentials' ? (
        // O-123-12: the fields-updated notice already says what to do; no "not saved yet" line with it.
        !showFieldsUpdated && (
          <div className="la-fields" role="status">
            <p className="la-empty la-empty--notice">{MSG_MISSING_USER_CREDENTIALS_LAUNCH}</p>
          </div>
        )
      ) : (
      <div className="la-fields">
        {loginFields.map((field) => {
          const value = activeCredential[field.id] ?? '';
          const masked = isFieldMasked(field);
          const inputType = masked && !passwordVisible ? 'password' : 'text';
          const copied = copyFlashFieldId === field.id;
          const eyeLabel = passwordVisible ? LABEL_HIDE_PASSWORD : LABEL_SHOW_PASSWORD;

          return (
            <div key={field.id} className="la-field" data-field-id={field.id}>
              <label className="la-field-label" htmlFor={`la-${service.id}-${field.id}`}>
                {field.label}
              </label>
              <div className="la-field-row">
                <input
                  id={`la-${service.id}-${field.id}`}
                  className="la-field-input"
                  type={inputType}
                  value={value}
                  readOnly
                  autoComplete="off"
                  spellCheck={false}
                />
                {masked && (
                  <button
                    type="button"
                    className="la-icon-btn"
                    onClick={() => setPasswordVisible((v) => !v)}
                    aria-pressed={passwordVisible}
                    aria-label={eyeLabel}
                    title={eyeLabel}
                  >
                    <IconEye open={passwordVisible} />
                  </button>
                )}
                <button
                  type="button"
                  className="la-icon-btn"
                  disabled={!value}
                  onClick={() => void handleCopy(field.id, value)}
                  aria-label={copied ? MSG_COPIED : LABEL_COPY}
                  title={copied ? MSG_COPIED : LABEL_COPY}
                >
                  <IconCopy copied={copied} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}

      <div className="la-actions">
        <button type="button" className="la-primary-btn" onClick={handleOpenSite}>
          {LABEL_OPEN_SITE}
        </button>
        {profileUi && actions.edit_profile && activeProfileId && onEditProfile && !showFieldsUpdated && (
          <button
            type="button"
            className="la-secondary-btn"
            data-action="edit-profile"
            onClick={() => onEditProfile(service, activeProfileId)}
          >
            {activeProfileComplete ? LABEL_EDIT_PROFILE : LABEL_COMPLETE_CREDENTIALS}
          </button>
        )}
        {profileUi && actions.add_profile && !actions.empty_state && onAddProfile && (
          <button
            type="button"
            className="la-secondary-btn"
            data-action="add-profile"
            onClick={() => onAddProfile(service)}
          >
            {LABEL_ADD_PROFILE}
          </button>
        )}
        {allowAuto && showCredentialUi && (
          <button
            type="button"
            className="la-secondary-btn la-secondary-btn--auto"
            disabled={
              !activeProfileId ||
              autoBusyProfileId === activeProfileId ||
              (activeProfileId !== null &&
                isManagedAutofillInFlightFor(service.id, activeProfileId))
            }
            onClick={() => void handleTryAuto()}
          >
            {LABEL_TRY_AUTO}
          </button>
        )}
      </div>

      {panelStatus?.failure && (
        <p className="la-panel-status la-panel-status--error" role="alert">
          {panelStatus.message}
        </p>
      )}
      {panelStatus && !panelStatus.failure && (
        <p className="la-panel-status" role="status" aria-live="polite">
          {panelStatus.message}
        </p>
      )}
    </section>
  );
}
