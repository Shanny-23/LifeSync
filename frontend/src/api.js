/**
 * LifeSync API re-export module.
 * Points to the standardized src/api/client.js.
 */
export * from './api/client';
import client from './api/client';
export const api = client;
export default client;
