# Mama Dye Dreams Backend API

Secure backend API with AWS Cognito authentication.

## Prerequisites

- Node.js 20 or higher
- AWS Account with Cognito User Pool configured
- npm or yarn

## Installation

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment file and configure:
```bash
cp .env.example .env
```

4. Edit `.env` file with your configuration:
```env
PORT=3001
NODE_ENV=development

# AWS Cognito Configuration
AWS_REGION=ap-south-1
COGNITO_USER_POOL_ID=ap-south-1_WNIHU8vZI
COGNITO_CLIENT_ID=3ouab6jn7e25sl0clsv5vu0pe1
COGNITO_CLIENT_SECRET=your-client-secret-here

# Session Secret (generate a random string)
SESSION_SECRET=generate-a-random-secret-key-here

# JWT Secret (generate a random string)
JWT_SECRET=generate-a-random-secret-key-here

# CORS Configuration
CORS_ORIGIN=http://localhost:8080

# Admin Email
ADMIN_EMAIL=admin@mamadyedreams.com
```

## Getting Cognito Client Secret

If your Cognito app client uses a client secret:

1. Go to AWS Cognito Console
2. Select your User Pool
3. Go to "App integration" → "App clients"
4. Click on your app client
5. Copy the "Client secret" value
6. Add it to your `.env` file as `COGNITO_CLIENT_SECRET`

**Note:** If you don't have a client secret, leave it empty in the `.env` file.

## Generating Secret Keys

Generate secure random keys for `SESSION_SECRET` and `JWT_SECRET`:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Or using OpenSSL
openssl rand -hex 64
```

## Running the Server

### Development Mode (with auto-reload):
```bash
npm run dev
```

### Production Mode:
```bash
npm run build
npm start
```

The server will start on `http://localhost:3001`

## API Endpoints

### Authentication

- `POST /api/auth/signup` - Register a new user
- `POST /api/auth/confirm` - Confirm email with verification code
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout (requires authentication)
- `GET /api/auth/me` - Get current user info (requires authentication)
- `POST /api/auth/refresh` - Refresh access token

### Health Check

- `GET /health` - Server health check

## API Request/Response Examples

### Sign Up
```bash
POST /api/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "requiresConfirmation": true,
  "message": "User created successfully. Please verify your email."
}
```

### Confirm Email
```bash
POST /api/auth/confirm
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456"
}
```

### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "email": "user@example.com",
    "userId": "user-id",
    "isAdmin": false,
    "name": "John Doe"
  },
  "tokens": {
    "accessToken": "access-token",
    "idToken": "id-token",
    "expiresIn": 3600
  }
}
```

### Get Current User
```bash
GET /api/auth/me
Authorization: Bearer <access-token>
```

## Security Features

1. **Session Management**: Uses Express sessions with secure cookies
2. **Token Validation**: Verifies Cognito tokens before allowing access
3. **CORS Protection**: Configured CORS to allow only your frontend origin
4. **Admin Check**: Middleware to verify admin access
5. **Secure Cookies**: HTTP-only cookies in production (HTTPS required)

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | 3001 |
| `NODE_ENV` | Environment | No | development |
| `AWS_REGION` | AWS region | Yes | - |
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID | Yes | - |
| `COGNITO_CLIENT_ID` | Cognito Client ID | Yes | - |
| `COGNITO_CLIENT_SECRET` | Cognito Client Secret | No | - |
| `SESSION_SECRET` | Session encryption secret | Yes | - |
| `JWT_SECRET` | JWT signing secret | Yes | - |
| `CORS_ORIGIN` | Allowed CORS origin | Yes | - |
| `ADMIN_EMAIL` | Admin user email | Yes | - |

## Troubleshooting

### "Client secret required" error
- Make sure `COGNITO_CLIENT_SECRET` is set if your app client requires it
- Check AWS Cognito console for client secret

### CORS errors
- Verify `CORS_ORIGIN` matches your frontend URL exactly
- Ensure credentials are enabled in frontend fetch requests

### Authentication fails
- Check Cognito User Pool ID and Client ID are correct
- Verify user is confirmed in Cognito
- Check AWS credentials have proper permissions

## Production Deployment

1. Set `NODE_ENV=production`
2. Use HTTPS for secure cookie transmission
3. Set strong `SESSION_SECRET` and `JWT_SECRET`
4. Configure proper CORS origins
5. Set up AWS credentials with appropriate IAM permissions
6. Use environment variables or secrets management (AWS Secrets Manager, etc.)

