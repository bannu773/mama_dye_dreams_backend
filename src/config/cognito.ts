import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import dotenv from 'dotenv';

dotenv.config();

export const cognitoConfig = {
  region: process.env.AWS_REGION || 'ap-south-1',
  userPoolId: process.env.COGNITO_USER_POOL_ID || 'ap-south-1_WNIHU8vZI',
  clientId: process.env.COGNITO_CLIENT_ID || '3ouab6jn7e25sl0clsv5vu0pe1',
  clientSecret: process.env.COGNITO_CLIENT_SECRET || '',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@mamadyedreams.com',
};

// Create Cognito client
export const cognitoClient = new CognitoIdentityProviderClient({
  region: cognitoConfig.region,
});

