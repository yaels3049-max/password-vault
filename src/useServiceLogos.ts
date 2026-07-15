import { useEffect, useRef, useState } from 'react';
import type { Service } from './mockServices';
import { getCachedServiceLogo, peekCachedLogo } from './logoCache';

/**
 * Resolves logos for a list of services.
 * Depends on service *ids* only — callers often pass inline arrays
 * (e.g. `useServiceLogos([service])`); treating the array identity as a
 * dependency caused an infinite setState loop and froze Credential Details.
 */
export function useServiceLogos(services: Service[]) {
  const serviceIds = services.map((service) => service.id).join('|');
  const servicesRef = useRef(services);
  servicesRef.current = services;

  const [logos, setLogos] = useState<Record<string, string | null>>(() => {
    const initial: Record<string, string | null> = {};
    for (const service of services) {
      const cached = peekCachedLogo(service.id);
      if (cached !== undefined) initial[service.id] = cached;
    }
    return initial;
  });

  useEffect(() => {
    let cancelled = false;
    const snapshot = servicesRef.current;

    for (const service of snapshot) {
      void getCachedServiceLogo(service).then((logo) => {
        if (cancelled) return;
        setLogos((prev) => {
          if (Object.prototype.hasOwnProperty.call(prev, service.id) && prev[service.id] === logo) {
            return prev;
          }
          return { ...prev, [service.id]: logo };
        });
      });
    }

    return () => {
      cancelled = true;
    };
  }, [serviceIds]);

  return logos;
}
