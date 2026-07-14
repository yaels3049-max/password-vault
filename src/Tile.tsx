import { useEffect, useState } from 'react';
import { getServiceInitial, gradientForName } from './serviceInitial';

interface TileProps {
  name: string;
  serviceId: string;
  logoSrc?: string | null;
  hasCredentials: boolean;
  /** Phase 113 — clicked tile stays identifiable while assistance floats nearby. */
  assisted?: boolean;
  onOpen: (anchorRect: DOMRect) => void;
}

export default function Tile({
  name,
  serviceId,
  logoSrc,
  hasCredentials,
  assisted = false,
  onOpen,
}: TileProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = getServiceInitial(name);
  const gradient = gradientForName(name);
  const showLogo = typeof logoSrc === 'string' && !imgFailed;

  useEffect(() => {
    setImgFailed(false);
  }, [logoSrc]);

  return (
    <div
      className={`app-icon-wrap${assisted ? ' app-icon-wrap--assisted' : ''}`}
      data-service-tile="true"
      data-service-id={serviceId}
    >
      <button
        type="button"
        className={`app-icon${showLogo ? '' : ' app-icon--letter'}${assisted ? ' app-icon--assisted' : ''}`}
        onClick={(event) => {
          const wrap = event.currentTarget.closest('[data-service-tile]');
          const rect = (wrap ?? event.currentTarget).getBoundingClientRect();
          onOpen(rect);
        }}
        aria-label={name}
        aria-expanded={assisted}
      >
        {hasCredentials && (
          <span className="app-icon-badge" aria-hidden="true" />
        )}
        {!showLogo && (
          <span
            className="app-icon-letter"
            style={{ background: gradient }}
            aria-hidden="true"
          >
            {initial}
          </span>
        )}
        {typeof logoSrc === 'string' && !imgFailed && (
          <img
            className="app-icon-img"
            src={logoSrc}
            alt=""
            onError={() => setImgFailed(true)}
          />
        )}
      </button>
      <span className="app-label">{name}</span>
    </div>
  );
}
