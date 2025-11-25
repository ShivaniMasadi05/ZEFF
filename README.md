# Zeff Frontend - Frappe Authentication

A Next.js application with Frappe authentication integration.

## Features

- 🔐 Secure authentication with Frappe backend
- 🎨 Modern glass morphism UI design
- 🍪 Cookie-based session management
- 🔄 Automatic authentication checks
- 📱 Responsive design

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Authentication Flow

1. **Login Page** (`/`) - User enters credentials
2. **API Proxy** - Next.js API routes handle Frappe communication
3. **Welcome Page** (`/welcome`) - Success page after login
4. **Logout** - Clears session and redirects to login

## API Routes

- `GET /api/auth/check` - Check authentication status
- `POST /api/auth/login` - Handle user login
- `POST /api/auth/logout` - Handle user logout

## Environment Variables

Create a `.env.local` file:

```env
FRAPPE_URL=https://zeff.valuepitch.ai
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Backend Configuration

The app connects to `https://zeff.valuepitch.ai` for authentication. Make sure the Frappe backend is properly configured for CORS and cookie handling.

## Technologies Used

- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Frappe Framework (Backend)

## Project Structure

```
app/
├── api/
│   └── auth/
│       ├── check/route.ts
│       ├── login/route.ts
│       └── logout/route.ts
├── welcome/
│   └── page.tsx
├── globals.css
├── layout.tsx
└── page.tsx
```

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Security Notes

- All authentication happens server-side through API routes
- Cookies are properly managed and forwarded
- CORS issues are avoided by using Next.js as a proxy
- Session management is handled by Frappe backend

