import { useCallback, useRef, useState, type ReactNode } from 'react';
import type { AccessProfile } from './accessProfileModel';
import ProfileChooserModal from './ProfileChooserModal';
import { planProfileResolution } from './profileResolution';

export type ProfileResolveResult = string | 'cancelled' | 'unavailable';

export type ResolveProfileFn = (serviceId: string) => Promise<ProfileResolveResult>;

interface PendingChooser {
  serviceId: string;
  serviceName: string;
  profiles: AccessProfile[];
  preselectedProfileId: string | null;
  resolve: (profileId: string | null) => void;
}

interface ProfileResolutionProps {
  accessProfiles: AccessProfile[];
  serviceNameById: Record<string, string>;
  children: (resolveProfile: ResolveProfileFn) => ReactNode;
}

/**
 * Execution-time profile resolution. Dashboard calls resolveProfile(serviceId) only;
 * this module owns chooser UI and resolution rules.
 */
export default function ProfileResolution({
  accessProfiles,
  serviceNameById,
  children,
}: ProfileResolutionProps) {
  const [pendingChooser, setPendingChooser] = useState<PendingChooser | null>(null);
  const accessProfilesRef = useRef(accessProfiles);
  accessProfilesRef.current = accessProfiles;

  const resolveProfile = useCallback<ResolveProfileFn>((serviceId) => {
    const outcome = planProfileResolution(accessProfilesRef.current, serviceId);

    if (outcome.kind === 'unavailable') {
      return Promise.resolve('unavailable');
    }

    if (outcome.kind === 'resolved') {
      return Promise.resolve(outcome.profileId);
    }

    return new Promise<ProfileResolveResult>((resolve) => {
      setPendingChooser({
        serviceId,
        serviceName: serviceNameById[serviceId] ?? serviceId,
        profiles: outcome.profiles,
        preselectedProfileId: outcome.preselectedProfileId,
        resolve: (profileId) => {
          if (profileId === null) {
            resolve('cancelled');
            return;
          }
          resolve(profileId);
        },
      });
    });
  }, [serviceNameById]);

  function closeChooser(profileId: string | null) {
    if (!pendingChooser) {
      return;
    }

    pendingChooser.resolve(profileId);
    setPendingChooser(null);
  }

  return (
    <>
      {children(resolveProfile)}
      {pendingChooser && (
        <ProfileChooserModal
          serviceName={pendingChooser.serviceName}
          profiles={pendingChooser.profiles}
          initialProfileId={pendingChooser.preselectedProfileId}
          onConfirm={(profileId) => closeChooser(profileId)}
          onCancel={() => closeChooser(null)}
        />
      )}
    </>
  );
}
