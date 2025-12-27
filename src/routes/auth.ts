import express from 'express';
import { signUp, signIn, signOut, getUserDetails } from '../services/authService.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { User } from '../models/User.js';

const router = express.Router();

/**
 * POST /api/auth/signup
 * User registration
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name, phoneNumber } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and name are required',
      });
    }

    // Phone number validation if provided
    if (phoneNumber) {
      const phoneRegex = /^(\+91)?[6-9]\d{9}$/;
      const cleanPhone = phoneNumber.replace(/\s+/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid phone number format. Use +919876543210 or 9876543210',
        });
      }
    }

    const result = await signUp(email, password, name, phoneNumber);

    res.json({
      success: true,
      requiresConfirmation: false,
      message: 'User created successfully. You can now login.',
      user: result.user
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create user account',
    });
  }
});

/**
 * POST /api/auth/login
 * User login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    const result = await signIn(email, password);

    // Store token in session
    if (req.session) {
      req.session.accessToken = result.accessToken;
      req.session.user = {
        email: result.user.email,
        userId: result.user.userId,
        isAdmin: result.user.isAdmin,
        name: result.user.name,
      };
    }

    res.json({
      success: true,
      user: result.user,
      tokens: {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Authentication failed',
    });
  }
});

/**
 * POST /api/auth/logout
 * User logout
 */
router.post('/logout', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
      }
    });

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    console.error('Logout error:', error);
    req.session.destroy(() => { });
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user information from session
 */
router.get('/me', async (req: AuthenticatedRequest, res) => {
  try {
    // Check if user session exists
    if (!req.session?.user || !req.session?.accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Get user from MongoDB for full details
    const user = await getUserDetails(req.session.user.email);

    res.json({
      success: true,
      user: user,
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(401).json({
      success: false,
      error: 'Failed to get user information',
    });
  }
});

export default router;
