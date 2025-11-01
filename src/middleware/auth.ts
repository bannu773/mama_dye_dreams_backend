import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/authService.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    email: string;
    userId: string;
    isAdmin: boolean;
    accessToken?: string;
  };
}

/**
 * Middleware to verify authentication
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Get token from Authorization header or session
    let token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token && req.session?.accessToken) {
      token = req.session.accessToken;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Verify token and get user info
    const user = await verifyToken(token);
    req.user = {
      email: user.email,
      userId: user.userId,
      isAdmin: user.isAdmin,
      accessToken: token,
    };

    next();
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      error: error.message || 'Invalid or expired token',
    });
  }
}

/**
 * Middleware to verify admin access
 */
export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  if (!req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
    });
  }

  next();
}

