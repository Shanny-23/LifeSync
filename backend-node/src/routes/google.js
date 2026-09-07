const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const googleTokens = require('../utils/google-tokens');
const db = require('../db');
const { formatSlot } = require('../utils/parsers');
const { inferUrgency } = require('../utils/urgency');
const { findConflicts } = require('../utils/conflicts');

/**
 * Creates an OAuth2 client configured with environment variables
 */
function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/google/callback';

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Helper to get an authenticated OAuth2 client with auto-refreshing tokens
 */
async function getAuthenticatedClient() {
  const tokens = await googleTokens.getTokens();
  if (!tokens || !tokens.access_token) {
    return null;
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(tokens);

  // Transparent token refresh listener
  oauth2Client.on('tokens', async (newTokens) => {
    console.log('[Google Auth] Transparently refreshed access token');
    await googleTokens.saveTokens(newTokens);
  });

  return oauth2Client;
}

/**
 * GET /api/google/auth
 * Redirects user to Google OAuth consent screen
 */
router.get('/auth', (req, res) => {
  const oauth2Client = createOAuth2Client();

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({
      error: 'Google OAuth not configured',
      message: 'Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend .env',
    });
  }

  const scopes = [
    'https://www.googleapis.com/auth/calendar.events.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // ensures refresh_token is returned
    prompt: 'consent',      // re-prompts to ensure refresh_token on reconnect
    scope: scopes,
  });

  res.redirect(authUrl);
});

/**
 * GET /api/google/callback
 * Exchanges auth code for tokens and persists them
 */
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error('[Google Auth] Consent error:', error);
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/upload?google_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code in query parameters' });
  }

  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Fetch user's email for status display
    let connectedEmail = null;
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      connectedEmail = userInfo.data.email || null;
    } catch (err) {
      console.warn('[Google Auth] Could not fetch user email:', err.message);
    }

    // Save tokens in flat-file single-user store
    await googleTokens.saveTokens({
      ...tokens,
      connected_email: connectedEmail,
    });

    console.log(`[Google Auth] Successfully connected Google Calendar for: ${connectedEmail || 'User'}`);

    // Redirect to frontend upload page with success indicator
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/upload?google_connected=true`);
  } catch (err) {
    console.error('[Google Auth] Token exchange failed:', err);
    res.status(500).json({ error: 'Failed to exchange authorization code for tokens', message: err.message });
  }
});

/**
 * GET /api/google/status
 * Returns connection status and connected email
 */
router.get('/status', async (req, res) => {
  try {
    const tokens = await googleTokens.getTokens();
    const isConnected = Boolean(tokens && (tokens.access_token || tokens.refresh_token));

    res.json({
      connected: isConnected,
      email: tokens.connected_email || null,
      expiryDate: tokens.expiry_date || null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve Google connection status', message: err.message });
  }
});

/**
 * POST /api/google/disconnect
 * Clears stored OAuth tokens
 */
router.post('/disconnect', async (req, res) => {
  try {
    await googleTokens.clearTokens();
    console.log('[Google Auth] Disconnected and cleared Google tokens');
    res.json({ success: true, message: 'Google Calendar disconnected successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disconnect Google Calendar', message: err.message });
  }
});

/**
 * POST /api/google/sync/import
 * Fetches Google Calendar events and maps them to LifeSync tasks
 * Query params:
 *   timeMin (ISO string, defaults to start of current week)
 *   timeMax (ISO string, defaults to end of current week)
 *   commit=true (persists tasks to database; otherwise returns preview + conflicts)
 */
router.post('/sync/import', async (req, res) => {
  try {
    const oauth2Client = await getAuthenticatedClient();
    if (!oauth2Client) {
      return res.status(401).json({
        error: 'Google Calendar not connected',
        message: 'Please authenticate with Google Calendar first at /api/google/auth',
      });
    }

    // Default time window: current week (Sunday 00:00 to Sunday 23:59)
    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setDate(now.getDate() - now.getDay());
    defaultStart.setHours(0, 0, 0, 0);

    const defaultEnd = new Date(defaultStart);
    defaultEnd.setDate(defaultStart.getDate() + 7);
    defaultEnd.setHours(23, 59, 59, 999);

    const timeMin = req.query.timeMin || defaultStart.toISOString();
    const timeMax = req.query.timeMax || defaultEnd.toISOString();
    const shouldCommit = req.query.commit === 'true';

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const eventsResponse = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    });

    const googleEvents = eventsResponse.data.items || [];

    // Map each Google event to LifeSync task shape
    const candidateTasks = googleEvents.map((event) => {
      const taskName = (event.summary || 'Untitled Google Event').trim();
      const endDateTime = event.end ? (event.end.dateTime || event.end.date) : null;
      const scheduledSlot = formatSlot(event.start, event.end);
      const category = (
        (event.organizer && (event.organizer.displayName || event.organizer.email)) ||
        'Google Calendar'
      ).trim();
      const urgency = inferUrgency(taskName, endDateTime);

      return {
        task: taskName,
        deadline: endDateTime ? new Date(endDateTime).toISOString().replace('T', ' ').substring(0, 16) : null,
        urgency,
        scheduledSlot,
        category,
        completed: false,
        googleEventId: event.id,
      };
    });

    // Run conflict detection against existing tasks
    const existingTasks = await db.getAllTasks();
    const conflicts = findConflicts(candidateTasks, existingTasks);

    if (shouldCommit) {
      const saveResult = await db.addTasks(candidateTasks);
      return res.status(201).json({
        success: true,
        committed: true,
        importedCount: saveResult.added.length,
        updatedCount: saveResult.updated.length,
        totalProcessed: candidateTasks.length,
        conflicts,
        tasks: saveResult.added.concat(saveResult.updated),
      });
    }

    // Preview mode (default)
    return res.json({
      success: true,
      committed: false,
      preview: true,
      timeWindow: { timeMin, timeMax },
      eventsFound: candidateTasks.length,
      conflictsCount: conflicts.length,
      conflicts,
      tasks: candidateTasks,
    });
  } catch (err) {
    console.error('[Google Import] Error syncing Google Calendar events:', err);

    // If token is invalid or expired and cannot be refreshed, return 401
    if (err.code === 401 || (err.message && err.message.includes('invalid_grant'))) {
      await googleTokens.clearTokens();
      return res.status(401).json({
        error: 'Google authentication expired',
        message: 'Please reconnect your Google account at /api/google/auth',
      });
    }

    res.status(500).json({ error: 'Failed to import Google Calendar events', message: err.message });
  }
});

module.exports = router;
