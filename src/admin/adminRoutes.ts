export const ADMIN_ROUTE_HASH = '#/admin';

export function isAdminRoute(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const { pathname, hash } = window.location;

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return true;
  }

  return hash === ADMIN_ROUTE_HASH || hash.startsWith(`${ADMIN_ROUTE_HASH}/`);
}
