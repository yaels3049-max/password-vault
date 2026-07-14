import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AccessProfile } from '../profile';
import { preselectedProfileId, profilesForService } from '../profile';
import type { Credential } from '../credentials';
import { getLoginFields, type Service } from '../mockServices';
import {
  attemptExistingAutomaticCompletion,
  openAssistanceUrl,
} from './assistanceActions';
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
  LABEL_CLOSE,
  LABEL_COPY,
  LABEL_HIDE_PASSWORD,
  LABEL_OPEN_SITE,
  LABEL_SHOW_PASSWORD,
  LABEL_TRY_AUTO,
  MSG_COPIED,
  MSG_COPY_FAILED,
  MSG_MANUAL_ONLY,
  MSG_NO_CREDENTIALS,
} from './messages';

const COPY_CONFIRM_MS = 2200;
const STATUS_MS = 8000;

export interface LoginAssistancePanelProps {
  service: Service;
  accessProfiles: AccessProfile[];
  credentialsByProfileId: Record<string, Credential>;
  /** Viewport rect of the clicked tile (D-113-15 anchor). */
  anchorRect: DOMRect;
  /** Same logo URL as the Home tile (when resolved). */
  logoSrc?: string | null;
  onClose: () => void;
  /** Bubble non-blocking status to Digital Home banner (optional). */
  onStatus?: (message: string, tone?: 'info' | 'warn' | 'success') => void;
}

export default function LoginAssistancePanel({
  service,
  accessProfiles,
  credentialsByProfileId,
  anchorRect,
  logoSrc = null,
  onClose,
  onStatus,
}: LoginAssistancePanelProps) {
  const profiles = profilesForService(accessProfiles, service.id);
  const level = resolveLoginAssistanceLevel(service);
  const allowAuto = allowsAutomaticCompletionAttempt(level);
  const loginFields = getLoginFields(service);
  const showProfileChips = profiles.length > 1;

  const panelRef = useRef<HTMLElement | null>(null);
  const [coords, setCoords] = useState<FloatingPanelCoords>(() =>
    computeFloatingPanelPosition(anchorRect),
  );

  const [activeProfileId, setActiveProfileId] = useState<string | null>(() =>
    preselectedProfileId(profiles, service.id),
  );
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [copyFlashFieldId, setCopyFlashFieldId] = useState<string | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);
  const [panelStatus, setPanelStatus] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);

  // Re-sync when service changes; single profile auto-select (AC-113-8).
  useEffect(() => {
    const next = profilesForService(accessProfiles, service.id);
    setActiveProfileId(preselectedProfileId(next, service.id));
    setPasswordVisible(false);
    setCopyFlashFieldId(null);
    setPanelStatus(null);
    setLogoFailed(false);
  }, [service.id, accessProfiles]);

  useEffect(() => {
    setLogoFailed(false);
  }, [logoSrc]);

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
  }, [anchorRect, service.id, showProfileChips, panelStatus, passwordVisible]);

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

  const activeCredential: Credential =
    (activeProfileId && credentialsByProfileId[activeProfileId]) || {};

  function showPanelStatus(message: string) {
    setPanelStatus(message);
    window.setTimeout(() => {
      setPanelStatus((current) => (current === message ? null : current));
    }, STATUS_MS);
  }

  function selectProfile(profileId: string) {
    setActiveProfileId(profileId);
    setPasswordVisible(false);
    setCopyFlashFieldId(null);
  }

  function handleOpenSite() {
    const result = openAssistanceUrl(service);
    if (result.status === 'unavailable') {
      showPanelStatus(result.message);
      onStatus?.(result.message, 'warn');
      return;
    }
    showPanelStatus(result.message);
    onStatus?.(result.message, 'success');
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
    showPanelStatus(MSG_COPY_FAILED);
    onStatus?.(MSG_COPY_FAILED, 'warn');
  }

  async function handleTryAuto() {
    if (!allowAuto) {
      showPanelStatus(MSG_MANUAL_ONLY);
      return;
    }
    setAutoBusy(true);
    try {
      const result = await attemptExistingAutomaticCompletion(
        service,
        activeProfileId,
        credentialsByProfileId,
      );
      showPanelStatus(result.message);
      onStatus?.(result.message, result.attempted ? 'info' : 'warn');
    } finally {
      setAutoBusy(false);
    }
  }

  return (
    <section
      ref={panelRef}
      className={`la-panel la-panel--float la-panel--side-${coords.side}`}
      aria-label={LABEL_ASSISTANCE}
      data-login-assistance="true"
      data-support-level={level}
      data-floating="true"
      style={{
        top: coords.top,
        left: coords.left,
        width: coords.width,
        maxHeight: coords.maxHeight,
      }}
    >
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

      {!allowAuto && (
        <p className="la-manual-hint" role="status">
          {MSG_MANUAL_ONLY}
        </p>
      )}

      {profiles.length === 0 && (
        <p className="la-empty">
          {MSG_NO_CREDENTIALS}
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

      <div className="la-fields">
        {loginFields.map((field) => {
          const value = activeCredential[field.id] ?? '';
          const isPassword = field.type === 'password';
          const inputType = isPassword && !passwordVisible ? 'password' : 'text';
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
                {isPassword && (
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

      <div className="la-actions">
        <button type="button" className="la-primary-btn" onClick={handleOpenSite}>
          {LABEL_OPEN_SITE}
        </button>
        {allowAuto && (
          <button
            type="button"
            className="la-secondary-btn la-secondary-btn--auto"
            disabled={autoBusy || !activeProfileId}
            onClick={() => void handleTryAuto()}
          >
            {LABEL_TRY_AUTO}
          </button>
        )}
      </div>

      {panelStatus && (
        <p className="la-panel-status" role="status" aria-live="polite">
          {panelStatus}
        </p>
      )}
    </section>
  );
}
