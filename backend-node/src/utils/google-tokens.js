// Single-user token storage — replace with per-user storage keyed by account id once real auth is added.

const fs = require('fs').promises;
const path = require('path');

const TOKENS_FILE = path.resolve(__dirname, '../../data/google-tokens.json');

// Serialized write chain to prevent file corruption
let writeQueue = Promise.resolve();

async function ensureStore() {
  try {
    await fs.mkdir(path.dirname(TOKENS_FILE), { recursive: true });
    await fs.access(TOKENS_FILE);
  } catch {
    await fs.writeFile(TOKENS_FILE, '{}', 'utf8');
  }
}

async function readTokens() {
  await ensureStore();
  try {
    const raw = await fs.readFile(TOKENS_FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.error('[GoogleTokens] Error reading tokens file:', err);
    return {};
  }
}

function writeTokens(tokenData) {
  writeQueue = writeQueue.then(async () => {
    await ensureStore();
    const tempFile = `${TOKENS_FILE}.tmp.${Date.now()}`;
    await fs.writeFile(tempFile, JSON.stringify(tokenData, null, 2), 'utf8');
    await fs.rename(tempFile, TOKENS_FILE);
  }).catch((err) => {
    console.error('[GoogleTokens] Serialized write failed:', err);
  });
  return writeQueue;
}

module.exports = {
  /**
   * Retrieves stored OAuth tokens: { access_token, refresh_token, expiry_date, scope, connected_email }
   */
  async getTokens() {
    return await readTokens();
  },

  /**
   * Saves or merges OAuth tokens
   */
  async saveTokens(tokens) {
    const current = await readTokens();
    const updated = {
      ...current,
      ...tokens,
      updatedAt: new Date().toISOString(),
    };
    await writeTokens(updated);
    return updated;
  },

  /**
   * Clears stored OAuth tokens
   */
  async clearTokens() {
    await writeTokens({});
    return true;
  },
};
