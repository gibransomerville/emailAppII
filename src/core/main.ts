import { app, BrowserWindow, ipcMain, dialog, Menu, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { URLSearchParams } from 'url';
import * as http from 'http';
import * as net from 'net';
import { fileURLToPath } from 'url';
import { OAUTH_CONFIG } from '../config/config.js';
import '../utils/attachment-handler.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load OAuth configuration from compiled TypeScript config
let oauthConfig: any;
try {
    oauthConfig = OAUTH_CONFIG;
} catch (error) {
    console.error('Config file not found or invalid. Please create config.ts with your OAuth credentials.');
    oauthConfig = {
        google: { clientId: 'MISSING', clientSecret: 'MISSING' },
        microsoft: { clientId: 'MISSING', clientSecret: 'MISSING' }
    };
}

let mainWindow: BrowserWindow | null;
let oauthWindow: BrowserWindow | null = null;
let oauthServer: http.Server | null = null;
let oauthResolve: ((value: any) => void) | null = null;
let oauthInProgress = false;
let googleAuthToken: any = null;

// Load Google token at startup
const tokenPath = path.join(app.getPath('userData'), 'google-token.json');
if (fs.existsSync(tokenPath)) {
  try {
    googleAuthToken = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  } catch (e) {
    console.error('Failed to load Google token at startup:', e);
    googleAuthToken = null;
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    titleBarStyle: 'default',
    show: false
  });

      mainWindow.loadFile('public/index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for email operations
ipcMain.handle('save-email-config', async (_event: IpcMainInvokeEvent, config: any) => {
  try {
    const configPath = path.join(app.getPath('userData'), 'email-config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-email-config', async () => {
  try {
    const configPath = path.join(app.getPath('userData'), 'email-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { success: true, config };
    }
    return { success: false, config: null };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Google OAuth token storage
ipcMain.handle('save-google-token', async (_event: IpcMainInvokeEvent, token: any) => {
  try {
    fs.writeFileSync(tokenPath, JSON.stringify(token, null, 2));
    googleAuthToken = token;
    return { success: true };
  } catch (error: any) {
    console.error('Error saving Google token:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-google-token', async () => {
  try {
    const tokenPath = path.join(app.getPath('userData'), 'google-token.json');
    if (fs.existsSync(tokenPath)) {
      const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
      return { success: true, token };
    }
    return { success: false, token: null };
  } catch (error: any) {
    console.error('Error loading Google token:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-google-token', async () => {
  try {
    const tokenPath = path.join(app.getPath('userData'), 'google-token.json');
    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath);
    }
    return { success: true };
  } catch (error: any) {
    console.error('Error clearing Google token:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('show-save-dialog', async (_event, options) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: options?.title || 'Save Attachment',
    defaultPath: options?.defaultPath || 'attachment',
    filters: options?.filters || [{ name: 'All Files', extensions: ['*'] }]
  });
  return result;
});

// Custom Google OAuth implementation
ipcMain.handle('google-sso', async () => {
  try {
    console.log('Google SSO requested');
    
    // Prevent concurrent OAuth flows
    if (oauthInProgress) {
      console.log('OAuth already in progress, rejecting duplicate request');
      return { success: false, error: 'OAuth flow already in progress. Please wait for the current flow to complete.' };
    }
    
    oauthInProgress = true;
    console.log('OAuth config:', {
      clientId: oauthConfig.google.clientId,
      clientSecret: oauthConfig.google.clientSecret ? '***' : 'MISSING',
      scopes: oauthConfig.google.scopes,
      redirectUri: oauthConfig.google.redirectUri
    });
    
    // Check if credentials are configured
    if (
      oauthConfig.google.clientId === 'MISSING' ||
      oauthConfig.google.clientId === 'YOUR_GOOGLE_CLIENT_ID_HERE'
    ) {
      oauthInProgress = false;
      return {
        success: false,
        error:
          'Google OAuth credentials not configured. Please update config.js with your Google Client ID and Secret.'
      };
    }

    return await new Promise((resolve) => {
      oauthResolve = resolve;

      // Close existing OAuth window if open
      if (oauthWindow) {
        oauthWindow.close();
        oauthWindow = null;
      }

      // Close existing server if running
      if (oauthServer) {
        oauthServer.close();
        oauthServer = null;
      }

      // Find an available port starting from 3100 with better error handling
      const findAvailablePort = (startPort = 3100, maxAttempts = 50): Promise<number> => {
        return new Promise((portResolve, portReject) => {
          let attempts = 0;
          
          const tryPort = (port: number) => {
            attempts++;
            console.log(`Attempting to bind to port ${port} (attempt ${attempts}/${maxAttempts})`);
            
            const server = net.createServer();
            
            server.once('error', (err: any) => {
              console.log(`Port ${port} is in use: ${err.code}`);
              server.close();
              
              if (attempts >= maxAttempts) {
                portReject(new Error(`Failed to find available port after ${maxAttempts} attempts`));
                return;
              }
              
              // Try next port
              setTimeout(() => tryPort(port + 1), 100);
            });
            
            server.listen(port, 'localhost', () => {
              const actualPort = (server.address() as any).port;
              console.log(`Successfully bound to port ${actualPort}`);
              server.close();
              portResolve(actualPort);
            });
          };
          
          tryPort(startPort);
        });
      };

      findAvailablePort().then((availablePort) => {
        console.log(`Using port ${availablePort} for OAuth callback`);
        const callbackUrl = `http://localhost:${availablePort}/callback`;

        // Start temporary HTTP server to handle callback
        oauthServer = http.createServer((req, res) => {
          const url = new URL(req.url || '', `http://localhost:${availablePort}`);
          console.log('OAuth callback received:', url.pathname, url.search);

          if (url.pathname === '/callback') {
            const code = url.searchParams.get('code');
            const error = url.searchParams.get('error');
            const errorDescription = url.searchParams.get('error_description');
            
            console.log('Callback parameters:', { code: code ? 'present' : 'missing', error, errorDescription });
            
            // Send response to browser
            res.writeHead(200, { 'Content-Type': 'text/html' });
            if (code) {
              res.end(`
                <html>
                  <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                    <h2 style="color: #4285F4;">✓ Authorization Successful!</h2>
                    <p>Processing your authorization...</p>
                    <p>You can close this window and return to the app.</p>
                    <script>
                      setTimeout(() => {
                        try { window.close(); } catch(e) {}
                      }, 3000);
                    </script>
                  </body>
                </html>
              `);
              
              // Process the authorization code
              console.log('Authorization code received, exchanging for token...');
              
              // Don't close the OAuth window immediately - let the callback finish
              exchangeCodeForToken(code, callbackUrl)
                .then(token => {
                  console.log('Token exchange successful');
                  
                  // Clear timeout
                  if (oauthWindow && (oauthWindow as any).oauthTimeout) {
                    clearTimeout((oauthWindow as any).oauthTimeout);
                  }
                  
                  // Close OAuth window after successful token exchange
                  if (oauthWindow) {
                    oauthWindow.close();
                    oauthWindow = null;
                  }
                  
                  // Close server
                  if (oauthServer) {
                    oauthServer.close();
                    oauthServer = null;
                  }
                  
                                      if (oauthResolve) {
                      oauthResolve({ success: true, token });
                      oauthResolve = null;
                    }
                    oauthInProgress = false;
                })
                .catch(error => {
                  console.error('Token exchange error:', error);
                  
                  // Close OAuth window on error
                  if (oauthWindow) {
                    oauthWindow.close();
                    oauthWindow = null;
                  }
                  
                  // Close server
                  if (oauthServer) {
                    oauthServer.close();
                    oauthServer = null;
                  }
                  
                                      if (oauthResolve) {
                      oauthResolve({ success: false, error: error.message });
                      oauthResolve = null;
                    }
                    oauthInProgress = false;
                });
            } else {
              res.end(`
                <html>
                  <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                    <h2 style="color: #d93025;">✗ Authorization Failed</h2>
                    <p>Error: ${errorDescription || error || 'Unknown error'}</p>
                    <p>You can close this window and try again.</p>
                    <script>
                      setTimeout(() => {
                        try { window.close(); } catch(e) {}
                      }, 3000);
                    </script>
                  </body>
                </html>
              `);
              
              console.log('OAuth authorization failed:', errorDescription || error);
              
              // Close OAuth window
              if (oauthWindow) {
                oauthWindow.close();
                oauthWindow = null;
              }
              
              // Close server
              if (oauthServer) {
                oauthServer.close();
                oauthServer = null;
              }
              
                              if (oauthResolve) {
                  oauthResolve({ 
                    success: false, 
                    error: errorDescription || error || 'OAuth authorization failed' 
                  });
                  oauthResolve = null;
                }
                oauthInProgress = false;
            }
          } else {
            res.writeHead(404);
            res.end('Not Found');
          }
        });

        oauthServer.listen(availablePort, 'localhost', () => {
          console.log(`OAuth callback server started on http://localhost:${availablePort}`);
          
          // Set a timeout for the OAuth flow (5 minutes)
          const oauthTimeout = setTimeout(() => {
            console.log('OAuth flow timed out after 5 minutes');
            
            if (oauthWindow) {
              oauthWindow.close();
              oauthWindow = null;
            }
            
            if (oauthServer) {
              oauthServer.close();
              oauthServer = null;
            }
            
                          if (oauthResolve) {
                oauthResolve({ success: false, error: 'OAuth flow timed out' });
                oauthResolve = null;
              }
              oauthInProgress = false;
          }, 5 * 60 * 1000); // 5 minutes

                      // Handle server errors
            oauthServer?.on('error', (error) => {
              console.error('OAuth server error:', error);
              if (oauthResolve) {
                oauthResolve({ success: false, error: 'Failed to start OAuth callback server: ' + error.message });
                oauthResolve = null;
              }
              oauthInProgress = false;
            });

          // Build OAuth URL with dynamic callback URL
          const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
          authUrl.searchParams.append('client_id', oauthConfig.google.clientId);
          authUrl.searchParams.append('redirect_uri', callbackUrl); // Use dynamic callback URL
          authUrl.searchParams.append('response_type', 'code');
          authUrl.searchParams.append('scope', oauthConfig.google.scopes.join(' '));
          authUrl.searchParams.append('access_type', 'offline');
          authUrl.searchParams.append('prompt', 'consent');

          console.log('Starting Google OAuth flow...');
          console.log('OAuth URL:', authUrl.toString());

          // Create OAuth window
          oauthWindow = new BrowserWindow({
            width: 800,
            height: 600,
            show: true,
            modal: true,
            parent: mainWindow ?? undefined,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true
            },
            autoHideMenuBar: true,
            title: 'Sign in with Google'
          });

          // Store timeout reference to clear it if needed
          (oauthWindow as any).oauthTimeout = oauthTimeout;

          oauthWindow.loadURL(authUrl.toString());

          // Add debugging for window events
          oauthWindow.webContents.on('did-finish-load', () => {
            console.log('OAuth window finished loading');
          });

          oauthWindow.webContents.on('did-navigate', (_event, navigationUrl) => {
            console.log('OAuth window navigated to:', navigationUrl);
          });

          oauthWindow.webContents.on('will-navigate', (_event, navigationUrl) => {
            console.log('OAuth window will navigate to:', navigationUrl);
            
            // If navigating to our callback, don't prevent it
            if (navigationUrl.includes(`localhost:${availablePort}/callback`)) {
              console.log('Allowing navigation to callback URL');
            }
          });

          // Handle window closed - but add delay to allow callback processing
          oauthWindow.on('closed', () => {
            console.log('OAuth window closed');
            
            // Clear timeout
            if (oauthTimeout) {
              clearTimeout(oauthTimeout);
            }
            
            // Add a small delay to allow any pending callback processing
            setTimeout(() => {
              oauthWindow = null;
              
              // Close server if still running
              if (oauthServer) {
                console.log('Closing OAuth server due to window closure');
                oauthServer.close();
                oauthServer = null;
              }
              
                              // Only resolve with error if we haven't already resolved
                if (oauthResolve) {
                  console.log('Resolving with window closed error');
                  oauthResolve({ success: false, error: 'OAuth window was closed by user' });
                  oauthResolve = null;
                }
                oauthInProgress = false;
            }, 1000); // 1 second delay
          });
        }); // End of oauthServer.listen
      }).catch((error: any) => {
        console.error('Failed to find available port:', error);
        if (oauthResolve) {
          oauthResolve({ success: false, error: 'Failed to find available port for OAuth callback' });
          oauthResolve = null;
        }
        oauthInProgress = false;
      }); // End of findAvailablePort().then(...).catch(...)
    }); // End of new Promise
  } catch (error: any) {
    console.error('Fatal error in google-sso handler:', error);
    oauthInProgress = false;
    return { success: false, error: error.message || 'Unknown error in google-sso handler' };
  }
}); // End of ipcMain.handle('google-sso', ...)

// Exchange authorization code for access token
async function exchangeCodeForToken(authCode: string, callbackUrl: string): Promise<any> {
  console.log('Starting token exchange...');
  console.log('Auth code:', authCode.substring(0, 20) + '...');
  console.log('Callback URL:', callbackUrl);
  console.log('Client ID:', oauthConfig.google.clientId);
  console.log('Client Secret present:', !!oauthConfig.google.clientSecret);
  
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const params = new URLSearchParams();
  params.append('client_id', oauthConfig.google.clientId);
  params.append('client_secret', oauthConfig.google.clientSecret);
  params.append('code', authCode);
  params.append('grant_type', 'authorization_code');
  params.append('redirect_uri', callbackUrl);

  console.log('Token exchange request params:', {
    client_id: oauthConfig.google.clientId,
    client_secret: '***',
    code: authCode.substring(0, 20) + '...',
    grant_type: 'authorization_code',
    redirect_uri: callbackUrl
  });

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params
    });

    console.log('Token exchange response status:', response.status);
    console.log('Token exchange response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token exchange error response:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { error: 'Failed to parse error response', raw: errorText };
      }
      
      console.error('Parsed error data:', errorData);
      throw new Error(errorData.error_description || errorData.error || `Token exchange failed with status ${response.status}`);
    }

    const tokenData = await response.json();
    console.log('Token exchange successful, received data:', {
      access_token: tokenData.access_token ? '***' : 'missing',
      refresh_token: tokenData.refresh_token ? '***' : 'missing',
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type,
      scope: tokenData.scope
    });
    
    return {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expiry_date: Date.now() + (tokenData.expires_in * 1000),
      token_type: tokenData.token_type,
      scope: tokenData.scope
    };
  } catch (error) {
    console.error('Token exchange fetch error:', error);
    throw error;
  }
}

// Microsoft SSO (keeping the existing implementation for now)
ipcMain.handle('microsoft-sso', async () => {
  return { success: false, error: 'Microsoft SSO not implemented yet' };
});

// IPC handler for fetching Gmail emails
ipcMain.handle('fetch-gmail-emails', async (_event, params = {}) => {
  try {
    console.log('Fetch Gmail emails requested:', params);
    
    if (!params.auth || !params.auth.access_token) {
      return { success: false, error: 'No valid authentication token provided' };
    }

    // Import googleapis dynamically to avoid module resolution issues
    const { google } = await import('googleapis');
    
    // Create OAuth2 client with the provided token
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials(params.auth);
    
    // Create Gmail API instance
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Fetch message list
    const messagesResponse = await gmail.users.messages.list({
      userId: 'me',
      labelIds: params.labelIds || ['INBOX'],
      maxResults: params.maxResults || 50
    });
    
    if (!messagesResponse.data.messages || messagesResponse.data.messages.length === 0) {
      console.log('No messages found in Gmail');
      return { success: true, emails: [] };
    }
    
    console.log(`Found ${messagesResponse.data.messages.length} messages in Gmail`);
    
    // Fetch full message details for each message
    const emailPromises = messagesResponse.data.messages.map(async (message) => {
      try {
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'full'
        });
        
        // Extract email data from Gmail API response
        const headers = fullMessage.data.payload?.headers || [];
        const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
        
        // Extract both HTML and text content
        const bodyContent = extractMessageBody(fullMessage.data.payload);
        
        // Extract attachment information from payload
        const attachments = extractAttachments(fullMessage.data.payload, fullMessage.data.id || message.id!);
        
        return {
          id: fullMessage.data.id,
          messageId: fullMessage.data.id,
          threadId: fullMessage.data.threadId,
          from: getHeader('from'),
          to: getHeader('to').split(',').map(s => s.trim()).filter(Boolean),
          subject: getHeader('subject'),
          date: new Date(parseInt(fullMessage.data.internalDate || '0')).toISOString(),
          body: bodyContent.html || bodyContent.text || '',
          bodyHtml: bodyContent.html || undefined,
          bodyText: bodyContent.text || undefined,
          snippet: fullMessage.data.snippet || '',
          isHtml: bodyContent.isHtml,
          read: !fullMessage.data.labelIds?.includes('UNREAD'),
          attachments: attachments
        };
      } catch (error) {
        console.warn(`Failed to fetch Gmail message ${message.id}:`, error);
        return null;
      }
    });
    
    // Wait for all messages to be processed
    const emails = (await Promise.all(emailPromises)).filter(email => email !== null);
    
    console.log(`Successfully processed ${emails.length} Gmail emails`);
    return { success: true, emails };
    
  } catch (error: any) {
    console.error('Error fetching Gmail emails:', error);
    return { success: false, error: error.message || 'Failed to fetch Gmail emails' };
  }
});

// IPC handler for sending Gmail emails
ipcMain.handle('send-gmail-email', async (_event, params) => {
  try {
    console.log('Send Gmail email requested:', { to: params.to, subject: params.subject });
    
    if (!params.auth || !params.auth.access_token) {
      return { success: false, error: 'No valid authentication token provided' };
    }

    // Import googleapis dynamically
    const { google } = await import('googleapis');
    
    // Create OAuth2 client with the provided token
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials(params.auth);
    
    // Create Gmail API instance
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Get user's email address
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const fromEmail = profile.data.emailAddress;
    
    // Construct email message
    const email = [
      `From: ${fromEmail}`,
      `To: ${params.to}`,
      params.cc ? `Cc: ${params.cc}` : '',
      `Subject: ${params.subject}`,
      '',
      params.body
    ].filter(line => line !== '').join('\n');
    
    // Encode email in base64url format
    const encodedEmail = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    // Send email
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail
      }
    });
    
    console.log('Email sent successfully via Gmail API:', response.data);
    return { success: true, data: response.data };
    
  } catch (error: any) {
    console.error('Error sending Gmail email:', error);
    return { success: false, error: error.message || 'Failed to send Gmail email' };
  }
});

// IPC handler for refreshing Google tokens
ipcMain.handle('refresh-google-token', async (_event, currentToken) => {
  try {
    if (!currentToken || !currentToken.refresh_token) {
      return { success: false, error: 'No refresh token available' };
    }

    // Import googleapis dynamically
    const { google } = await import('googleapis');
    
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      oauthConfig.google.clientId,
      oauthConfig.google.clientSecret
    );
    
    oauth2Client.setCredentials(currentToken);
    
    // Refresh the token
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    const refreshedToken = {
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token || currentToken.refresh_token,
      expiry_date: credentials.expiry_date || Date.now() + 3600000,
      token_type: credentials.token_type || 'Bearer',
      scope: currentToken.scope
    };
    
    console.log('Token refreshed successfully');
    return { success: true, token: refreshedToken };
    
  } catch (error: any) {
    console.error('Error refreshing Google token:', error);
    return { success: false, error: error.message || 'Failed to refresh token' };
  }
});

// IPC handler for validating Google tokens
ipcMain.handle('validate-google-token', async (_event, token) => {
  try {
    if (!token || !token.access_token) {
      return { success: false, valid: false, error: 'No token provided' };
    }

    // Import googleapis dynamically
    const { google } = await import('googleapis');
    
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials(token);
    
    // Test the token by making a simple API call
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    await gmail.users.getProfile({ userId: 'me' });
    
    return { success: true, valid: true };
    
  } catch (error: any) {
    console.warn('Token validation failed:', error);
    return { success: true, valid: false, error: error.message };
  }
});

// IPC handler for parsing raw email messages
ipcMain.handle('parse-raw-email', async (_event, rawData) => {
  try {
    // Import mailparser in main process where Node.js modules work properly
    const { simpleParser } = await import('mailparser');
    
    let rawText = rawData;
    // Try to decode base64url if input looks like base64
    try {
      if (/^[A-Za-z0-9_-]+={0,2}$/.test(rawData) && rawData.length > 100) {
        rawText = Buffer.from(rawData, 'base64url').toString('utf-8');
      }
    } catch (e) {
      console.warn('Not base64url, using as plain text');
    }
    
    const parsed = await simpleParser(rawText);
    
    // Helper function to extract address string
    const extractAddress = (addr: any): string => {
      if (!addr) return '';
      if (typeof addr === 'string') return addr;
      if (addr.text) return addr.text;
      if (Array.isArray(addr.value) && addr.value.length > 0) {
        return addr.value[0].address || '';
      }
      return '';
    };
    
    // Extract attachment information
    const attachments = (parsed.attachments || []).map(att => ({
      filename: att.filename,
      contentType: att.contentType,
      size: att.size,
      contentId: att.contentId,
      contentDisposition: att.contentDisposition,
      cid: att.cid,
      checksum: att.checksum,
      related: att.related,
      headers: att.headers ? Object.fromEntries(att.headers.entries()) : {},
    }));
    
    return {
      success: true,
      parsed: {
        messageId: parsed.messageId || '',
        date: parsed.date?.toISOString() || '',
        from: extractAddress(parsed.from),
        to: extractAddress(parsed.to),
        subject: parsed.subject || '',
        bodyHtml: parsed.html || '',
        bodyText: parsed.text || '',
        attachments,
        headers: Object.fromEntries(parsed.headers.entries()),
      }
    };
    
  } catch (error: any) {
    console.error('Error parsing raw email:', error);
    return { success: false, error: error.message };
  }
});

// Helper function to extract message body from Gmail payload
function extractMessageBody(payload: any): { html: string; text: string; isHtml: boolean } {
  if (!payload) return { html: '', text: '', isHtml: false };
  
  let htmlContent = '';
  let textContent = '';
  
  // If the payload has a body with data, use it
  if (payload.body && payload.body.data) {
    const content = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    if (payload.mimeType === 'text/html') {
      htmlContent = content;
    } else {
      textContent = content;
    }
  }
  
  // If the payload has parts, look for text/html and text/plain
  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body && part.body.data) {
        htmlContent = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        textContent = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      
      // Recursively check nested parts
      if (part.parts) {
        const nestedResult = extractMessageBody(part);
        if (nestedResult.html && !htmlContent) htmlContent = nestedResult.html;
        if (nestedResult.text && !textContent) textContent = nestedResult.text;
      }
    }
  }
  
  // Determine if this is primarily HTML content
  const isHtml = Boolean(htmlContent.length > textContent.length || (htmlContent && !textContent));
  
  return {
    html: htmlContent,
    text: textContent,
    isHtml
  };
}

// Helper function to extract attachments from Gmail payload
function extractAttachments(payload: any, messageId: string): any[] {
  if (!payload || !payload.parts || !Array.isArray(payload.parts)) return [];
  
  const attachments: any[] = [];
  
  for (const part of payload.parts) {
    // Check if this part is an attachment
    if (part.filename && part.filename.length > 0) {
      // This is an attachment
      attachments.push({
        filename: part.filename,
        contentType: part.mimeType || 'application/octet-stream',
        size: part.body?.size || 0,
        contentId: part.contentId,
        contentDisposition: part.contentDisposition,
        cid: part.cid,
        attachmentId: part.body?.attachmentId, // Gmail-specific attachment ID for fetching content
        messageId: messageId, // Store message ID for fetching content later
        encoding: 'base64',
        // Content will be fetched lazily when needed
        content: null
      });
    }
    
    // Recursively check nested parts
    if (part.parts) {
      const nestedAttachments = extractAttachments(part, messageId);
      attachments.push(...nestedAttachments);
    }
  }
  
  return attachments;
}

// Create application menu
const template: Electron.MenuItemConstructorOptions[] = [
  {
    label: 'File',
    submenu: [
      {
        label: 'New Email',
        accelerator: 'CmdOrCtrl+N',
        click: () => {
          mainWindow?.webContents.send('new-email');
        }
      },
      {
        label: 'Refresh',
        accelerator: 'CmdOrCtrl+R',
        click: () => {
          mainWindow?.webContents.send('refresh-emails');
        }
      },
      { type: 'separator' },
      {
        label: 'Settings',
        click: () => {
          mainWindow?.webContents.send('open-settings');
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
        click: () => {
          app.quit();
        }
      }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  }
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

ipcMain.handle('fetch-gmail-raw-message', async (_event, { messageId, auth }) => {
  try {
    if (!auth || !auth.access_token) {
      return { success: false, error: 'No valid authentication token provided' };
    }
    // Import googleapis dynamically to avoid module resolution issues
    const { google } = await import('googleapis');
    // Create OAuth2 client with the provided token
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials(auth);
    // Create Gmail API instance
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    // Fetch the raw message
    const res = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'raw'
    });
    return { success: true, raw: res.data.raw };
  } catch (error) {
    const err = error && typeof error === 'object' && 'message' in error ? (error as any).message : String(error);
    return { success: false, error: err };
  }
});

// IPC handler for fetching Gmail attachment content
ipcMain.handle('fetch-gmail-attachment', async (_event, { messageId, attachmentId, auth }) => {
  try {
    if (!auth || !auth.access_token) {
      return { success: false, error: 'No valid authentication token provided' };
    }
    if (!messageId || !attachmentId) {
      return { success: false, error: 'Message ID and attachment ID are required' };
    }
    
    // Import googleapis dynamically to avoid module resolution issues
    const { google } = await import('googleapis');
    // Create OAuth2 client with the provided token
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials(auth);
    // Create Gmail API instance
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Fetch the attachment content
    const res = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: messageId,
      id: attachmentId
    });
    
    return { success: true, data: res.data.data, size: res.data.size };
  } catch (error) {
    const err = error && typeof error === 'object' && 'message' in error ? (error as any).message : String(error);
    return { success: false, error: err };
  }
});

// Usage: ipcRenderer.invoke('fetch-gmail-raw-message', { messageId, auth: googleAuth })

// Provide token to renderer on request
ipcMain.handle('get-google-auth', async () => {
  return googleAuthToken;
});

ipcMain.handle('write-file', async (_event: IpcMainInvokeEvent, { filePath, buffer, mimeType }) => {
  try {
    // Buffer may be sent as a Uint8Array or Array, ensure it's a Buffer
    let data = buffer;
    if (!(buffer instanceof Buffer)) {
      data = Buffer.from(buffer.data || buffer);
    }
    fs.writeFileSync(filePath, data);
    return { success: true };
  } catch (error: any) {
    console.error('Error writing file:', error);
    return { success: false, error: error.message };
  }
}); 