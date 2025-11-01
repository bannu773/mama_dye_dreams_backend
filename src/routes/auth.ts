import express from 'express';
import { signUp, signIn, confirmSignUp, signOut, refreshToken, getUserDetails } from '../services/authService.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/auth/signup
 * User registration
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and name are required',
      });
    }

    const result = await signUp(email, password, name);
    res.json({
      success: true,
      requiresConfirmation: result.requiresConfirmation,
      message: 'User created successfully. Please verify your email.',
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
 * POST /api/auth/confirm
 * Confirm email verification code
 */
router.post('/confirm', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: 'Email and verification code are required',
      });
    }

    await confirmSignUp(email, code);
    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error: any) {
    console.error('Confirm error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to verify email',
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

    if (!result.success) {
      return res.status(400).json({
        success: false,
        challenge: result.challenge,
        session: result.session,
      });
    }

    // Store tokens in session
    req.session.accessToken = result.accessToken;
    req.session.idToken = result.idToken;
    req.session.refreshToken = result.refreshToken;
    req.session.user = result.user;

    res.json({
      success: true,
      user: result.user,
      tokens: {
        accessToken: result.accessToken,
        idToken: result.idToken,
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
    if (req.session.accessToken) {
      await signOut(req.session.accessToken);
    }

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
    // Still clear session even if Cognito sign out fails
    req.session.destroy(() => {});
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;
    res.json({
      success: true,
      user: {
        email: user?.email,
        userId: user?.userId,
        isAdmin: user?.isAdmin,
      },
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user information',
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken: refreshTokenValue, username } = req.body;

    if (!refreshTokenValue || !username) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token and username are required',
      });
    }

    const result = await refreshToken(refreshTokenValue, username);

    // Update session
    req.session.accessToken = result.accessToken;
    req.session.idToken = result.idToken;

    res.json({
      success: true,
      tokens: {
        accessToken: result.accessToken,
        idToken: result.idToken,
        expiresIn: result.expiresIn,
      },
    });
  } catch (error: any) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Failed to refresh token',
    });
  }
});

export default router;

