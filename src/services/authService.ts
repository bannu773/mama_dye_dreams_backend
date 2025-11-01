import {
  AdminInitiateAuthCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminConfirmSignUpCommand,
  AdminGetUserCommand,
  AdminDeleteUserCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  ConfirmSignUpCommand,
  SignUpCommand,
  GlobalSignOutCommand,
  CreateSecretHash,
} from '@aws-sdk/client-cognito-identity-provider';
import { cognitoClient, cognitoConfig } from '../config/cognito.js';
import crypto from 'crypto';

/**
 * Generate secret hash for Cognito authentication
 */
function generateSecretHash(username: string): string {
  if (!cognitoConfig.clientSecret) {
    throw new Error('COGNITO_CLIENT_SECRET is not configured');
  }
  return crypto
    .createHmac('SHA256', cognitoConfig.clientSecret)
    .update(username + cognitoConfig.clientId)
    .digest('base64');
}

/**
 * User sign up
 */
export async function signUp(email: string, password: string, name: string) {
  const params = {
    ClientId: cognitoConfig.clientId,
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'name', Value: name },
      { Name: 'email_verified', Value: 'false' },
    ],
    ...(cognitoConfig.clientSecret && {
      SecretHash: generateSecretHash(email),
    }),
  };

  try {
    const command = new SignUpCommand(params);
    const response = await cognitoClient.send(command);
    
    return {
      success: true,
      userId: response.UserSub,
      requiresConfirmation: response.CodeDeliveryDetails !== undefined,
    };
  } catch (error: any) {
    console.error('Sign up error:', error);
    throw new Error(error.message || 'Failed to create user account');
  }
}

/**
 * Confirm sign up with verification code
 */
export async function confirmSignUp(email: string, code: string) {
  const params = {
    ClientId: cognitoConfig.clientId,
    Username: email,
    ConfirmationCode: code,
    ...(cognitoConfig.clientSecret && {
      SecretHash: generateSecretHash(email),
    }),
  };

  try {
    const command = new ConfirmSignUpCommand(params);
    await cognitoClient.send(command);
    return { success: true };
  } catch (error: any) {
    console.error('Confirm sign up error:', error);
    throw new Error(error.message || 'Failed to verify email');
  }
}

/**
 * User sign in
 */
export async function signIn(email: string, password: string) {
  const authParams: any = {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: cognitoConfig.clientId,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
      ...(cognitoConfig.clientSecret && {
        SECRET_HASH: generateSecretHash(email),
      }),
    },
  };

  try {
    const command = new InitiateAuthCommand(authParams);
    const response = await cognitoClient.send(command);

    if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      return {
        success: false,
        challenge: 'NEW_PASSWORD_REQUIRED',
        session: response.Session,
      };
    }

    if (response.AuthenticationResult) {
      // Get user details to check if admin
      const userDetails = await getUserDetails(email);
      
      return {
        success: true,
        accessToken: response.AuthenticationResult.AccessToken,
        idToken: response.AuthenticationResult.IdToken,
        refreshToken: response.AuthenticationResult.RefreshToken,
        expiresIn: response.AuthenticationResult.ExpiresIn,
        user: userDetails,
      };
    }

    throw new Error('Authentication failed');
  } catch (error: any) {
    console.error('Sign in error:', error);
    
    // Handle specific error types
    if (error.name === 'NotAuthorizedException') {
      throw new Error('Incorrect email or password');
    } else if (error.name === 'UserNotConfirmedException') {
      throw new Error('Please verify your email address first');
    } else if (error.name === 'UserNotFoundException') {
      throw new Error('User not found');
    }
    
    throw new Error(error.message || 'Authentication failed');
  }
}

/**
 * Get user details from Cognito
 */
export async function getUserDetails(email: string) {
  const params = {
    UserPoolId: cognitoConfig.userPoolId,
    Username: email,
  };

  try {
    const command = new AdminGetUserCommand(params);
    const response = await cognitoClient.send(command);
    
    const emailAttr = response.UserAttributes?.find(attr => attr.Name === 'email');
    const nameAttr = response.UserAttributes?.find(attr => attr.Name === 'name');
    const emailValue = emailAttr?.Value || email;
    
    return {
      email: emailValue,
      username: response.Username,
      userId: response.UserSub,
      isAdmin: emailValue === cognitoConfig.adminEmail,
      emailVerified: response.UserStatus === 'CONFIRMED',
      name: nameAttr?.Value || '',
    };
  } catch (error: any) {
    console.error('Get user details error:', error);
    throw new Error('Failed to fetch user details');
  }
}

/**
 * Verify access token and get user info
 */
export async function verifyToken(accessToken: string) {
  try {
    // Decode the JWT token to extract username
    // In production, you should verify the signature properly using Cognito's JWKs
    const userDetails = await getUserDetailsFromToken(accessToken);
    return userDetails;
  } catch (error: any) {
    console.error('Verify token error:', error);
    throw new Error('Invalid or expired token');
  }
}

/**
 * Get user details from access token
 */
async function getUserDetailsFromToken(accessToken: string) {
  // Decode the JWT token to extract username
  // In production, verify the signature properly using Cognito's JWKs
  try {
    const tokenParts = accessToken.split('.');
    if (tokenParts.length !== 3) {
      throw new Error('Invalid token format');
    }
    
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    // Extract username from token - Cognito stores it in different places
    const username = payload['cognito:username'] || payload.username || payload.sub || payload.email;
    
    if (!username) {
      throw new Error('Username not found in token');
    }
    
    // Get user details from Cognito
    return await getUserDetails(username);
  } catch (error: any) {
    console.error('Get user from token error:', error);
    throw new Error('Failed to extract user from token');
  }
}

/**
 * Sign out user
 */
export async function signOut(accessToken: string) {
  try {
    const command = new GlobalSignOutCommand({
      AccessToken: accessToken,
    });
    await cognitoClient.send(command);
    return { success: true };
  } catch (error: any) {
    console.error('Sign out error:', error);
    throw new Error('Failed to sign out');
  }
}

/**
 * Refresh access token
 */
export async function refreshToken(refreshToken: string, username: string) {
  const params: any = {
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    ClientId: cognitoConfig.clientId,
    AuthParameters: {
      REFRESH_TOKEN: refreshToken,
      ...(cognitoConfig.clientSecret && {
        SECRET_HASH: generateSecretHash(username),
      }),
    },
  };

  try {
    const command = new InitiateAuthCommand(params);
    const response = await cognitoClient.send(command);

    if (response.AuthenticationResult) {
      return {
        success: true,
        accessToken: response.AuthenticationResult.AccessToken,
        idToken: response.AuthenticationResult.IdToken,
        expiresIn: response.AuthenticationResult.ExpiresIn,
      };
    }

    throw new Error('Token refresh failed');
  } catch (error: any) {
    console.error('Refresh token error:', error);
    throw new Error('Failed to refresh token');
  }
}

