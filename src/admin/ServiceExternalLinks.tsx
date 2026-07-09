interface ServiceExternalLinksProps {
  primaryUrl: string | null | undefined;
  loginUrl?: string | null;
  compact?: boolean;
}

function trimUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export default function ServiceExternalLinks({
  primaryUrl,
  loginUrl,
  compact = false,
}: ServiceExternalLinksProps) {
  const home = trimUrl(primaryUrl);
  const login = trimUrl(loginUrl);

  if (!home && !login) {
    return null;
  }

  const linkClass = compact
    ? 'admin-external-link admin-external-link--compact'
    : 'admin-external-link';

  return (
    <nav
      className={`admin-external-links${compact ? ' admin-external-links--compact' : ''}`}
      aria-label="קישורי אתר"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {home && (
        <a href={home} target="_blank" rel="noopener noreferrer" className={linkClass} title={home}>
          {compact ? 'דף בית' : 'דף בית'}
        </a>
      )}
      {login && (
        <a href={login} target="_blank" rel="noopener noreferrer" className={linkClass} title={login}>
          {compact ? 'דף כניסה' : 'דף כניסה'}
        </a>
      )}
    </nav>
  );
}
