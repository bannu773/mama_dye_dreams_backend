import express from 'express';
import { signUp, signIn, confirmSignUp, signOut, refreshToken, getUserDetails } from '../services/authService.js';
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

    // Confirm with Cognito
    await confirmSignUp(email, code);

    // Get user details from Cognito
    const cognitoUser = await getUserDetails(email);

    // Create user in MongoDB
    try {
      // Check if user already exists
      let user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        // Create new user in MongoDB
        user = new User({
          cognitoId: cognitoUser.userId || '',
          email: email.toLowerCase(),
          name: cognitoUser.name || '',
          phone: '', // Will be updated if available
          addresses: [],
          role: email.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase() ? 'admin' : 'customer',
          isEmailVerified: true,
        });

        await user.save();
        console.log('✅ User created in MongoDB:', user._id);
      } else {
        // Update existing user
        user.isEmailVerified = true;
        if (cognitoUser.userId) {
          user.cognitoId = cognitoUser.userId;
        }
        await user.save();
        console.log('✅ User updated in MongoDB:', user._id);
      }
    } catch (dbError: any) {
      console.error('MongoDB error during user creation:', dbError);
      // Don't fail the request if MongoDB fails, Cognito user is already confirmed
    }

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

    console.log('Login attempt for email:', email);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    const result = await signIn(email, password);

    if (!result.success || !result.user) {
      return res.status(400).json({
        success: false,
        challenge: result.challenge,
        session: result.session,
      });
    }

    // Sync user with MongoDB (create if doesn't exist)
    let mongoUser;
    try {
      let user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        // Create user in MongoDB if not exists
        user = new User({
          cognitoId: result.user.userId || '',
          email: email.toLowerCase(),
          name: result.user.name || '',
          phone: '',
          addresses: [],
          role: email.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase() ? 'admin' : 'customer',
          isEmailVerified: result.user.emailVerified || false,
        });

        await user.save();
        console.log('✅ User created in MongoDB during login:', user._id);
      } else {
        // Update user role if admin email
        if (email.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase() && user.role !== 'admin') {
          user.role = 'admin';
          await user.save();
          console.log('✅ User role updated to admin:', user._id);
        }
      }

      mongoUser = user;
    } catch (dbError: any) {
      console.error('MongoDB error during login:', dbError);
      // Don't fail login if MongoDB fails
    }

    // Store tokens in session
    req.session.accessToken = result.accessToken;
    req.session.idToken = result.idToken;
    req.session.refreshToken = result.refreshToken;
    req.session.user = {
      email: result.user.email,
      userId: result.user.userId || '',
      isAdmin: mongoUser?.role === 'admin' || false,
      name: result.user.name,
    };

    res.json({
      success: true,
      user: {
        ...result.user,
        isAdmin: mongoUser?.role === 'admin' || false,
        role: mongoUser?.role || 'customer', // Add role field
        _id: mongoUser?._id?.toString(), // Add MongoDB ID
        cognitoId: result.user.userId || '',
        phone: mongoUser?.phone || '',
        addresses: mongoUser?.addresses || [],
        createdAt: mongoUser?.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: mongoUser?.updatedAt?.toISOString() || new Date().toISOString(),
      },
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
    const mongoUser = await User.findOne({ email: req.session.user.email.toLowerCase() });

    if (!mongoUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      user: {
        email: mongoUser.email,
        userId: req.session.user.userId,
        cognitoId: mongoUser.cognitoId,
        name: mongoUser.name,
        phone: mongoUser.phone || '',
        isAdmin: mongoUser.role === 'admin',
        role: mongoUser.role,
        _id: mongoUser._id.toString(),
        addresses: mongoUser.addresses || [],
        emailVerified: mongoUser.isEmailVerified,
        createdAt: mongoUser.createdAt?.toISOString(),
        updatedAt: mongoUser.updatedAt?.toISOString(),
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

