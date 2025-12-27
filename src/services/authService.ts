import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'mama-dye-dreams-secret-key-change-in-prod';
const JWT_EXPIRES_IN = '30d'; // Long lived token (30 days) since we removed refresh token

/**
 * Generate hash and salt for password
 */
function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

/**
 * Verify password against hash and salt
 */
function verifyPassword(password: string, hash: string, salt: string): boolean {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

/**
 * User sign up
 */
export async function signUp(email: string, password: string, name: string, phoneNumber?: string) {
  try {
    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const { hash, salt } = hashPassword(password);

    const user = new User({
      email: email.toLowerCase(),
      name,
      phone: phoneNumber,
      password: hash,
      salt: salt,
      isEmailVerified: true, // Auto-verify for simplicity as requested
      role: email.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase() ? 'admin' : 'customer',
      addresses: []
    });

    await user.save();

    return {
      success: true,
      requiresConfirmation: false,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    };
  } catch (error: any) {
    console.error('Sign up error:', error);
    throw new Error(error.message || 'Failed to create user account');
  }
}

/**
 * User sign in
 */
export async function signIn(email: string, password: string) {
  try {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password +salt');

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check if user has password (might be old Cognito user)
    if (!user.password || !user.salt) {
      throw new Error('Please reset your password to login');
    }

    const isValid = verifyPassword(password, user.password, user.salt);

    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
        isAdmin: user.role === 'admin'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Return user without sensitive data
    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.salt;

    return {
      success: true,
      accessToken: token,
      user: {
        ...userObj,
        userId: (user._id as any).toString(), // Keep compatibility with frontend expecting userId
        isAdmin: user.role === 'admin'
      },
      expiresIn: 30 * 24 * 60 * 60 // 30 days in seconds
    };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw new Error(error.message || 'Authentication failed');
  }
}

/**
 * Verify access token and get user info
 */
export async function verifyToken(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      isAdmin: decoded.isAdmin
    };
  } catch (error: any) {
    console.error('Verify token error:', error);
    throw new Error('Invalid or expired token');
  }
}

/**
 * Get user details (wrapper for consistency)
 */
export async function getUserDetails(email: string) {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new Error('User not found');
  }
  return {
    email: user.email,
    userId: (user._id as any).toString(),
    name: user.name,
    role: user.role,
    isAdmin: user.role === 'admin',
    phone: user.phone,
    addresses: user.addresses,
    isEmailVerified: user.isEmailVerified
  };
}

/**
 * Sign out (placeholder as JWT is stateless, but we can handle cleanup if needed)
 */
export async function signOut(accessToken: string) {
  // In a stateless JWT system, we can't really invalidate the token server-side 
  // without a blacklist/redis. For now, we just return success.
  return { success: true };
}
