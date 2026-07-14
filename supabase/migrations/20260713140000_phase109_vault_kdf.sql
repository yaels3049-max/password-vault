-- Phase 109 D-109-24: store vault KDF params (salt + algorithm) so a second
-- browser can derive the same client-side AES key and decrypt encrypted_credentials.
-- Salt is not secret; plaintext passwords/keys never leave the client (ZK).

alter table public.users
  add column if not exists vault_kdf jsonb null;

comment on column public.users.vault_kdf is
  'Client vault KDF params (argon2id salt + cost). Enables cross-browser decrypt of encrypted_credentials. Never stores password or AES key.';
