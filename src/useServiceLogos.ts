import { useEffect, useState } from 'react';
import type { Service } from './mockServices';
import { getCachedServiceLogo, peekCachedLogo } from './logoCache';

export function useServiceLogos(services: Service[]) {
  const serviceIds = services.map((service) => service.id).join('|');

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

    for (const service of services) {
      void getCachedServiceLogo(service).then((logo) => {
        if (!cancelled) {
          setLogos((prev) => ({ ...prev, [service.id]: logo }));
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [serviceIds, services]);

  return logos;
}
