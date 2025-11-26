import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    userRole?: 'customer' | 'admin';
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

