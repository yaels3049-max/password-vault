/** Compact equal-size icon glyphs for Login Assistance (D-113-15). */

const SIZE = 16;

export function IconCopy({ copied = false }: { copied?: boolean }) {
  if (copied) {
    return (
      <svg width={SIZE} height={SIZE} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M6.2 11.4 2.8 8l1.1-1.1 2.3 2.3 5-5L12.3 5.3z"
        />
      </svg>
    );
  }
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M5.5 2A1.5 1.5 0 0 0 4 3.5v8A1.5 1.5 0 0 0 5.5 13h6A1.5 1.5 0 0 0 13 11.5v-8A1.5 1.5 0 0 0 11.5 2h-6zm0 1h6a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5h-6a.5.5 0 0 1-.5-.5v-8a.5.5 0 0 1 .5-.5zM2.5 4v8.5A2.5 2.5 0 0 0 5 15h6.5v-1H5a1.5 1.5 0 0 1-1.5-1.5V4h-1z"
      />
    </svg>
  );
}

export function IconEye({ open: _open }: { open: boolean }) {
  // Login Assistance (D-113-15): always an eye glyph — state via aria only.
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M8 3C3.5 3 1 8 1 8s2.5 5 7 5 7-5 7-5-2.5-5-7-5zm0 8.2A3.2 3.2 0 1 1 8 4.8a3.2 3.2 0 0 1 0 6.4zM8 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"
      />
    </svg>
  );
}

/** Eye-off for Credential Details reveal toggle (D-113-25 / AC-113-40). */
export function IconEyeOff() {
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M2.1 1.4 1.4 2.1l2.1 2.1C2.1 5.3 1.2 6.7 1 8c0 0 2.5 5 7 5 1.3 0 2.4-.4 3.4-1l2.1 2.1.7-.7L2.1 1.4zM8 11.2c-1.8 0-3.2-1.4-3.2-3.2 0-.5.1-1 .4-1.4l1.1 1.1A2 2 0 0 0 8 10a2 2 0 0 0 1.3-.5l1.1 1.1c-.4.3-.9.6-1.4.6zm5.6-1.5-1.3-1.3c.1-.3.2-.6.2-.9A3.2 3.2 0 0 0 8 4.8c-.3 0-.6 0-.9.1L5.8 3.6C6.5 3.2 7.2 3 8 3c4.5 0 7 5 7 5-.3.7-1.1 2-2.4 2.7z"
      />
    </svg>
  );
}

export function IconClose() {
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M3.2 2.3 2.3 3.2 7.1 8l-4.8 4.8.9.9L8 8.9l4.8 4.8.9-.9L8.9 8l4.8-4.8-.9-.9L8 7.1 3.2 2.3z"
      />
    </svg>
  );
}
