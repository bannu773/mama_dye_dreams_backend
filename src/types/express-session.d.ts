import 'express-session';

declare module 'express-session' {
  interface SessionData {
    accessToken?: string;
    idToken?: string;
    refreshToken?: string;
    user?: {
      email: string;
      userId: string;
      isAdmin: boolean;
      name?: string;
    };
  }
}

