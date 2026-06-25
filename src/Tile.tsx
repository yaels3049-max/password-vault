import { useEffect, useState } from 'react';
import { getServiceInitial, gradientForName } from './serviceInitial';

interface TileProps {
  name: string;
  logoSrc?: string | null;
  hasCredentials: boolean;
  onOpen: () => void;
  onEditCredentials: () => void;
}

export default function Tile({
  name,
  logoSrc,
  hasCredentials,
  onOpen,
  onEditCredentials,
}: TileProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = getServiceInitial(name);
  const gradient = gradientForName(name);
  const showLogo = typeof logoSrc === 'string' && !imgFailed;

  useEffect(() => {
    setImgFailed(false);
  }, [logoSrc]);

  return (
    <div className="app-icon-wrap">
      <button
        type="button"
        className={`app-icon${showLogo ? '' : ' app-icon--letter'}`}
        onClick={onOpen}
        aria-label={name}
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
      <button
        type="button"
        className="tile-credentials-btn"
        onClick={onEditCredentials}
      >
        פרטי כניסה
      </button>
    </div>
  );
}
