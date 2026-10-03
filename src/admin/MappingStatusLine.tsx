import type { ReactNode } from 'react';
import { ADMIN_MAPPING_COPY_HE, ADMIN_MAPPING_STATUS_HE, type AdminMappingStatus } from './mappingCopy';

/**
 * D-121-43 — one status line for every login pattern, with the technical facts of
 * the editor under a collapsed «פרטים טכניים». `children` = in-progress spans.
 */
export default function MappingStatusLine({
  status,
  technical,
  children,
}: {
  status: AdminMappingStatus | null;
  technical?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <>
      {status || children ? (
        <p className="admin-autofill-state" data-status="mapping-status" data-mapping-status={status ?? 'none'}>
          {status ? (
            <>
              {ADMIN_MAPPING_COPY_HE.statusLabel} <strong>{ADMIN_MAPPING_STATUS_HE[status]}</strong>
            </>
          ) : null}
          {children}
        </p>
      ) : null}
      {technical ? (
        <details className="admin-special-test-details" data-section="mapping-technical">
          <summary>{ADMIN_MAPPING_COPY_HE.technicalDetails}</summary>
          {technical}
        </details>
      ) : null}
    </>
  );
}
