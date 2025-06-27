# Electron Email App

A modern, feature-rich email desktop application built with Electron, Node.js, and vanilla JavaScript. This application provides a beautiful and intuitive interface for managing your emails with support for multiple email providers.

## Features

### ✨ Modern UI/UX
- Beautiful gradient design with smooth animations
- Responsive layout that works on different screen sizes
- Intuitive navigation with sidebar folders
- Real-time search functionality
- Loading states and notifications

### 📧 Email Management
- **Send & Receive**: Full email functionality with SMTP and IMAP support
- **Multiple Folders**: Inbox, Sent, Drafts, and Trash
- **Search**: Real-time email search across all fields
- **Compose**: Rich email composition with CC support
- **Drafts**: Save emails as drafts for later editing
- **Delete**: Secure email deletion with confirmation

### 🔧 Configuration
- **Email Provider Support**: Works with Gmail, Outlook, Yahoo, and other providers
- **Secure Storage**: Email credentials stored securely in user data
- **Custom Settings**: Configurable SMTP and IMAP settings
- **Auto-save**: Automatic configuration persistence

### 🔐 Single Sign-On (SSO)
- **Google OAuth**: Sign in with Google for Gmail access
- **Microsoft OAuth**: Sign in with Microsoft for Outlook/Office 365 access
- **Secure Token Storage**: OAuth tokens stored securely
- **Automatic Refresh**: Tokens automatically refreshed when needed

### ⌨️ Keyboard Shortcuts
- `Ctrl/Cmd + N`: New email
- `Ctrl/Cmd + R`: Refresh emails
- `Ctrl/Cmd + Delete`: Delete selected email

## Installation

### Prerequisites
- Node.js (version 14 or higher)
- npm or yarn package manager

### Setup Instructions

1. **Clone or download the project**
   ```bash
   git clone <repository-url>
   cd electron-email-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure OAuth (Optional but Recommended)**
   - See [OAuth Setup](#oauth-setup) section below
   - This enables SSO login for Gmail and Microsoft accounts

4. **Run the application**
   ```bash
   # Development mode with DevTools
   npm run dev
   
   # Production mode
   npm start
   ```

5. **Build for distribution**
   ```bash
   # Build for current platform
   npm run build
   
   # Build for all platforms
   npm run dist
   ```

## OAuth Setup

### Google OAuth Setup (for Gmail SSO)

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/apis/credentials
   - Sign in with your Google account

2. **Create or Select a Project**
   - Click on the project dropdown at the top
   - Create a new project or select an existing one

3. **Enable Gmail API**
   - Go to **APIs & Services > Library**
   - Search for "Gmail API"
   - Click on it and press **Enable**

4. **Create OAuth 2.0 Credentials**
   - Go to **APIs & Services > Credentials**
   - Click **Create Credentials > OAuth 2.0 Client IDs**
   - Choose **Desktop application** as the application type
   - Give it a name (e.g., "Electron Email App")
   - Click **Create**

5. **Copy Credentials**
   - Copy the **Client ID** and **Client Secret**
   - Update your `config.js` file with these values

### Microsoft OAuth Setup (for Outlook/Office 365 SSO)

1. **Go to Azure Portal**
   - Visit: https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade
   - Sign in with your Microsoft account

2. **Register New Application**
   - Click **New registration**
   - Name: "Electron Email App"
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI: `http://localhost`
   - Click **Register**

3. **Create Client Secret**
   - Go to **Certificates & secrets**
   - Click **New client secret**
   - Add a description and choose expiration
   - Copy the generated secret value

4. **Copy Credentials**
   - Copy the **Application (client) ID** from the Overview page
   - Copy the **Client Secret** from the Certificates & secrets page
   - Update your `config.js` file with these values

### Update Configuration File

1. **Edit `config.js`**
   ```javascript
   module.exports = {
       google: {
           clientId: 'YOUR_ACTUAL_GOOGLE_CLIENT_ID',
           clientSecret: 'YOUR_ACTUAL_GOOGLE_CLIENT_SECRET',
           redirectUri: 'http://localhost',
           scopes: ['https://mail.google.com/', 'https://www.googleapis.com/auth/gmail.readonly']
       },
       microsoft: {
           clientId: 'YOUR_ACTUAL_MICROSOFT_CLIENT_ID',
           clientSecret: 'YOUR_ACTUAL_MICROSOFT_CLIENT_SECRET',
           redirectUri: 'http://localhost',
           scopes: [
               'https://graph.microsoft.com/Mail.ReadWrite',
               'https://graph.microsoft.com/Mail.Send',
               'offline_access'
           ]
       }
   };
   ```

2. **Security Note**
   - The `config.js` file is already in `.gitignore`
   - Never commit this file with real credentials
   - Consider using environment variables for production

## Configuration

### Email Provider Settings

Before using the app, you need to configure your email provider settings:

1. Click the **Settings** button in the sidebar
2. Enter your email credentials:
   - **Email Address**: Your full email address
   - **Password**: Your email password or app-specific password
   - **SMTP Host**: Outgoing mail server (e.g., `smtp.gmail.com`)
   - **SMTP Port**: Outgoing mail port (usually 587 or 465)
   - **IMAP Host**: Incoming mail server (e.g., `imap.gmail.com`)
   - **IMAP Port**: Incoming mail port (usually 993)

### Common Email Provider Settings

#### Gmail
- **SMTP Host**: `smtp.gmail.com`
- **SMTP Port**: `587`
- **IMAP Host**: `imap.gmail.com`
- **IMAP Port**: `993`
- **Note**: Enable 2-factor authentication and use an App Password

#### Outlook/Hotmail
- **SMTP Host**: `smtp-mail.outlook.com`
- **SMTP Port**: `587`
- **IMAP Host**: `outlook.office365.com`
- **IMAP Port**: `993`

#### Yahoo
- **SMTP Host**: `smtp.mail.yahoo.com`
- **SMTP Port**: `587`
- **IMAP Host**: `imap.mail.yahoo.com`
- **IMAP Port**: `993`

## Usage

### Basic Operations

1. **Viewing Emails**
   - Select a folder from the sidebar (Inbox, Sent, Drafts, Trash)
   - Click on any email in the list to view its contents
   - Use the search bar to find specific emails

2. **Composing Emails**
   - Click the **Compose** button or use `Ctrl/Cmd + N`
   - Fill in the recipient, subject, and message
   - Click **Send** to send the email
   - Click **Save Draft** to save for later

3. **Managing Emails**
   - Select an email and click the **Delete** button to remove it
   - Use the **Refresh** button to check for new emails
   - Search emails using the search bar

### SSO Login

1. **Google SSO**
   - Click **Sign in with Google** in the settings
   - Authorize the app to access your Gmail
   - Your emails will be loaded automatically

2. **Microsoft SSO**
   - Click **Sign in with Microsoft** in the settings
   - Authorize the app to access your Outlook/Office 365
   - Your emails will be loaded automatically

### Advanced Features

- **Email Search**: Real-time search across sender, subject, and content
- **Folder Navigation**: Switch between different email folders
- **Email Counts**: See the number of emails in each folder
- **Responsive Design**: Works on different window sizes
- **Keyboard Navigation**: Use keyboard shortcuts for quick actions

## Project Structure

```
electron-email-app/
├── main.js              # Main Electron process
├── renderer.js          # Renderer process (UI logic)
├── index.html           # Main application HTML
├── styles.css           # Application styles
├── config.js            # OAuth configuration (create this)
├── package.json         # Project configuration
├── README.md           # This file
└── assets/             # Application assets (icons, etc.)
```

## Development

### Running in Development Mode

```bash
npm run dev
```

This will start the application with DevTools open for debugging.

### Building the Application

```bash
# Build for current platform
npm run build

# Build for all platforms (Windows, macOS, Linux)
npm run dist
```

### Code Structure

- **`main.js`**: Handles the main Electron process, window management, and IPC communication
- **`renderer.js`**: Manages the UI interactions, email operations, and user experience
- **`index.html`**: The main application interface
- **`styles.css`**: Complete styling with modern design and responsive layout
- **`config.js`**: OAuth configuration (you need to create this)

## Security Considerations

- Email credentials are stored locally in the user's application data directory
- OAuth tokens are stored securely and automatically refreshed
- Passwords are stored in plain text (consider encryption for production use)
- The application uses secure connections (TLS) for email communication
- No data is sent to external servers except for email operations
- OAuth credentials in `config.js` are excluded from version control

## Troubleshooting

### Common Issues

1. **OAuth "invalid_client" Error**
   - Make sure you've updated `config.js` with real credentials
   - Verify the Client ID and Secret are correct
   - Check that the redirect URI matches exactly

2. **Email Connection Failed**
   - Verify your email credentials
   - Check if your email provider requires an App Password
   - Ensure the SMTP/IMAP settings are correct

3. **App Won't Start**
   - Make sure Node.js is installed (version 14+)
   - Run `npm install` to install dependencies
   - Check for any error messages in the terminal

4. **Emails Not Loading**
   - Verify your IMAP settings
   - Check your internet connection
   - Ensure your email provider allows IMAP access

### Getting Help

If you encounter issues:
1. Check the console for error messages
2. Verify your email provider settings
3. Ensure all dependencies are installed correctly
4. Try running in development mode for more detailed error information

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with [Electron](https://electronjs.org/)
- Email functionality powered by [Nodemailer](https://nodemailer.com/) and [IMAP](https://github.com/mscdex/node-imap)
- OAuth support via [electron-oauth2](https://github.com/mawie81/electron-oauth2)
- Icons from [Font Awesome](https://fontawesome.com/)
- Modern UI design inspired by contemporary email clients 