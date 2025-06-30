# 📁 Email Client Folder Structure

This document describes the organized folder structure of the email client to make it easier for LLMs and developers to navigate and understand the codebase.

## 🏗️ **Project Structure Overview**

```
emailApp/
├── src/                    # Source TypeScript files
│   ├── core/              # Core business logic & entry points
│   ├── ui/                # User interface components & themes
│   ├── email/             # Email-specific functionality
│   ├── auth/              # Authentication & security
│   ├── config/            # Configuration files
│   ├── utils/             # Utility functions & helpers
│   └── managers/          # High-level system managers
├── assets/                # Static assets
│   ├── styles/            # CSS stylesheets
│   └── images/            # Image assets
├── public/                # Public files served to browser
├── docs/                  # Documentation
├── types/                 # TypeScript type definitions
├── dist/                  # Compiled JavaScript output
├── release/               # Release builds
└── node_modules/          # Dependencies
```

## 📂 **Detailed Folder Descriptions**

### **src/core/** - Core Business Logic
- `main.ts` - Main application entry point and Electron setup
- `renderer.ts` - Main renderer process initialization

### **src/ui/** - User Interface
- `ui-components.ts` - Reusable UI components
- `ui-theme-manager.ts` - Theme management and styling
- `email-processing-ui.ts` - Email processing UI components

### **src/email/** - Email Functionality
- `email-renderer.ts` - Email rendering and display logic
- `email-manager.ts` - Core email management
- `email-composer.ts` - Email composition functionality
- `email-actions.ts` - Email actions (reply, forward, etc.)
- `email-parser.ts` - Email parsing utilities
- `email-filter-manager.ts` - Email filtering system
- `gmail-style-processor.ts` - Gmail-style email processing
- `imap-email-manager.ts` - IMAP email handling
- `marketing-email-detector.ts` - Marketing email detection
- `threading-manager.ts` - Email threading logic

### **src/auth/** - Authentication
- `auth-manager.ts` - Authentication management and OAuth

### **src/config/** - Configuration
- `config.ts` - Main application configuration
- `email-processing-config.ts` - Email processing configuration
- `search-config.ts` - Search functionality configuration

### **src/utils/** - Utilities
- `safe-html.ts` - HTML sanitization utilities
- `attachment-handler.ts` - File attachment handling

### **src/managers/** - System Managers
- `event-manager.ts` - Event handling and DOM management
- `settings-manager.ts` - Application settings management
- `search-engine.ts` - Search functionality
- `search-manager.ts` - Search management

### **assets/** - Static Assets
- `styles/styles.css` - Main application stylesheet

### **public/** - Public Files
- `index.html` - Main HTML entry point

### **types/** - TypeScript Definitions
- `email.d.ts` - Email-related type definitions
- `config.d.ts` - Configuration type definitions
- `ui.d.ts` - UI-related type definitions
- `global.d.ts` - Global type definitions

## 🔄 **Build Process**

The TypeScript files in `src/` are compiled to JavaScript in the `dist/` folder:
- Source: `src/**/*.ts`
- Output: `dist/**/*.js` (with source maps)
- The app references only the compiled files in `dist/` for modular execution

## 🎯 **Key Architecture Features**

1. **Modular Design**: Each folder represents a specific domain of functionality
2. **Separation of Concerns**: UI, business logic, and utilities are clearly separated
3. **Email-Centric**: Core email functionality is centralized in `src/email/`
4. **LLM-Friendly**: Clear naming and organization for easy navigation
5. **TypeScript-First**: All source code is TypeScript with proper type definitions

## 🚀 **Getting Started for LLMs**

When navigating this codebase:

1. **Start with** `src/core/main.ts` for application entry point
2. **Email rendering** logic is in `src/email/email-renderer.ts`
3. **UI components** are in `src/ui/`
4. **Configuration** files are in `src/config/`
5. **Type definitions** are in `types/`

## 📋 **Current Features**

- ✅ Signature removal for non-marketing emails
- ✅ Gmail-style email processing
- ✅ Marketing email detection
- ✅ OAuth authentication
- ✅ Email threading
- ✅ Search functionality
- ✅ Theme management
- ✅ Attachment handling

This structure makes it easy to locate specific functionality and understand the relationships between different parts of the email client. 