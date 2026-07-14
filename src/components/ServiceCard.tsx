import { useEffect, useState, type ReactNode } from 'react';
import { getServiceInitial, gradientForName } from '../serviceInitial';
import {
  serviceManagementBadgeLabel,
  type ServiceManagementState,
} from '../serviceManagement/serviceManagementState';

/**
 * Card presentation variants for Service Management (management surface, not the
 * Digital Home execution surface):
 * - `row`: transparent fixed-grid management row (My Services).
 * - `compact`: medium discovery card (Discover) — smaller than a Digital Home tile.
 */
type ServiceCardLayout = 'row' | 'compact';

interface ServiceCardProps {
  name: string;
  categoryLabel: string;
  logoSrc?: string | null;
  state: ServiceManagementState;
  /** Hide the badge (e.g. for not-yet-added discover cards where it adds noise). */
  showBadge?: boolean;
  /** Number of access profiles; shown as a hint only when > 1 (D-104-6). */
  profileCount?: number;
  pending?: boolean;
  layout?: ServiceCardLayout;
  /** Discover cards: action slot (add/remove). */
  actions?: ReactNode;
  /** My Services row: primary manage action (grid column). */
  manageSlot?: ReactNode;
  /** My Services row: secondary ⋮ menu (grid column). */
  moreSlot?: ReactNode;
}

const BADGE_CLASS: Record<ServiceManagementState, string> = {
  not_added: 'service-card-badge--neutral',
  added: 'service-card-badge--ready',
  missing_credentials: 'service-card-badge--warn',
  multiple_profiles: 'service-card-badge--info',
};

/** Row status chip: compact label + chip tone (maps to existing rounded badge palette). */
const ROW_STATUS_CHIP: Record<
  ServiceManagementState,
  { label: string; tone: string }
> = {
  not_added: { label: 'לא נוסף', tone: 'neutral' },
  added: { label: 'מוכן', tone: 'ready' },
  missing_credentials: { label: 'חסרים פרטי כניסה', tone: 'warn' },
  /** Legacy mapping only — derive no longer emits this as attention (AC-113-31). */
  multiple_profiles: { label: 'מספר פרופילים', tone: 'ready' },
};

function ServiceCardLogo({
  name,
  logoSrc,
  imgFailed,
  onImgError,
}: {
  name: string;
  logoSrc?: string | null;
  imgFailed: boolean;
  onImgError: () => void;
}) {
  const initial = getServiceInitial(name);
  const gradient = gradientForName(name);
  const showLogo = typeof logoSrc === 'string' && !imgFailed;

  if (showLogo) {
    return (
      <img
        className="service-card-logo"
        src={logoSrc as string}
        alt=""
        onError={onImgError}
      />
    );
  }

  return (
    <span className="service-card-letter" style={{ background: gradient }}>
      {initial}
    </span>
  );
}

export default function ServiceCard({
  name,
  categoryLabel,
  logoSrc,
  state,
  showBadge = true,
  profileCount,
  pending = false,
  layout = 'compact',
  actions,
  manageSlot,
  moreSlot,
}: ServiceCardProps) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [logoSrc]);

  const statusChip = showBadge ? ROW_STATUS_CHIP[state] : null;

  return (
    <div
      className={`service-card service-card--${layout}${
        pending ? ' service-card--pending' : ''
      }`}
    >
      {layout === 'row' ? (
        <>
          <div className="service-row-col service-row-col-icon" aria-hidden="true">
            <ServiceCardLogo
              name={name}
              logoSrc={logoSrc}
              imgFailed={imgFailed}
              onImgError={() => setImgFailed(true)}
            />
          </div>

          <div className="service-row-col service-row-col-name">
            <span className="service-card-name">{name}</span>
          </div>

          <div className="service-row-col service-row-col-profiles">
            {typeof profileCount === 'number' && profileCount > 1 ? (
              <span className="service-row-profiles" title={`${profileCount} פרופילים`}>
                <span className="service-row-profiles-icon" aria-hidden="true">
                  👥
                </span>
                {profileCount}
              </span>
            ) : null}
          </div>

          <div className="service-row-col service-row-col-category">
            <span className="service-row-category">{categoryLabel}</span>
          </div>

          <div className="service-row-col service-row-col-status">
            {statusChip ? (
              <span
                className={`service-row-status service-row-status--${statusChip.tone}`}
                dir="rtl"
              >
                <span className="service-row-status-dot" aria-hidden="true" />
                <span className="service-row-status-text">{statusChip.label}</span>
              </span>
            ) : null}
          </div>

          <div className="service-row-col service-row-col-manage">{manageSlot}</div>

          <div className="service-row-col service-row-col-more">{moreSlot}</div>
        </>
      ) : (
        <>
          <div className="service-card-media" aria-hidden="true">
            <ServiceCardLogo
              name={name}
              logoSrc={logoSrc}
              imgFailed={imgFailed}
              onImgError={() => setImgFailed(true)}
            />
          </div>
          <div className="service-card-body">
            <span className="service-card-name">{name}</span>
            <span className="service-card-category">{categoryLabel}</span>
            {showBadge && (
              <span className={`service-card-badge ${BADGE_CLASS[state]}`}>
                {serviceManagementBadgeLabel(state)}
              </span>
            )}
            {typeof profileCount === 'number' && profileCount > 1 && (
              <span className="service-card-profile-count">{profileCount} פרופילים</span>
            )}
          </div>
          {actions && <div className="service-card-actions">{actions}</div>}
        </>
      )}
    </div>
  );
}
