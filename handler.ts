import serverless from 'serverless-http';
import app from './server.js';

// Wrap Express app with serverless-http for Lambda compatibility
// Configure to handle binary data properly
export const main = serverless(app, {
    binary: ['image/*', 'multipart/form-data'],
});
