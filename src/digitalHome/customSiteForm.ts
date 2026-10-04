import type { AddSiteFormValues } from '../AddSiteModal';
import { createCustomServiceDefinition } from '../catalog';
import type { ServiceDefinition } from '../service/serviceModel';

/** AddSiteModal values → custom definition (create, or edit keeping id + metadata). */
export function buildCustomSiteDefinition(
  values: AddSiteFormValues,
  existing?: { id: string; metadata?: Record<string, unknown> },
): ServiceDefinition {
  return createCustomServiceDefinition({
    id: existing?.id,
    displayName: values.displayName,
    primaryUrl: values.primaryUrl,
    category: values.category,
    sameAsWebsite: values.sameAsWebsite,
    dedicatedLoginUrl: values.dedicatedLoginUrl,
    metadata: existing?.metadata,
  });
}
