# Directory credentials encryption

Directory connection configs (Azure AD, Google Workspace, LDAP, AWS, Okta
secrets and SCIM bearer tokens) are encrypted at rest in
`DirectoryConnection.encryptedConfig`. Implementation: `src/lib/directory/crypto.ts`.

## Algorithm review

- **Cipher**: AES-256-GCM, an authenticated cipher. Confidentiality plus
  integrity, so a tampered ciphertext is rejected instead of silently
  decrypting to garbage.
- **Nonce/IV**: 12 random bytes (`randomBytes`) generated per encryption, the
  recommended size for GCM. A fresh IV per call means encrypting the same
  config twice yields different ciphertexts (no deterministic leak).
- **Auth tag**: 16 bytes, verified on decrypt; a wrong key or modified
  ciphertext throws.
- **Storage format**: `base64(iv | tag | ciphertext)` in a single column.
- **Key**: derived as `sha256(DIRECTORY_ENCRYPTION_KEY)` to normalize any input
  to a 32-byte AES key. The app refuses to start crypto operations if the key
  is missing or shorter than 32 characters.

### Known limitations

- `sha256` of the env value is a normalizer, not a password KDF (no salt, no
  stretching). This is safe **only if the key is a high-entropy random value**.
  Generate it with `openssl rand -base64 32`; do not use a human-chosen
  passphrase.
- No additional authenticated data (AAD). Ciphertexts are not bound to their
  row, so a database-level actor could swap one connection's blob onto another.
  Acceptable given DB access is already full compromise; revisit if needed.

## Key rotation procedure

Decryption tries the current key first, then the optional previous key, so
rotation is zero-downtime.

1. Generate a new key: `openssl rand -base64 32`.
2. In the environment, set `DIRECTORY_ENCRYPTION_KEY` to the **new** key and
   `DIRECTORY_ENCRYPTION_KEY_PREVIOUS` to the **old** key. Deploy. New writes
   use the new key; existing rows still decrypt via the previous key.
3. Re-encrypt all stored configs under the new key:
   `npm run reencrypt:directory`. The script is idempotent.
4. Once it reports success for every row, remove
   `DIRECTORY_ENCRYPTION_KEY_PREVIOUS` and redeploy.

If the script reports rows it could not decrypt, do **not** drop the previous
key: those rows were encrypted under a key neither value matches, and dropping
the fallback makes them permanently unreadable.
