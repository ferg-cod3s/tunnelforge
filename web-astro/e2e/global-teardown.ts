/**
 * Global teardown for Playwright tests
 * Runs once after all tests
 */

export default async function globalTeardown() {
  console.log('🧹 Starting global test teardown...');

  // You can add global cleanup logic here
  // For example: database cleanup, test data removal, etc.

  console.log('✅ Global test teardown completed');
}