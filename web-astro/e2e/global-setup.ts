/**
 * Global setup for Playwright tests
 * Runs once before all tests
 */

import { chromium } from '@playwright/test';

export default async function globalSetup() {
  console.log('🚀 Starting global test setup...');

  // You can add global setup logic here
  // For example: database setup, test data preparation, etc.

  console.log('✅ Global test setup completed');
}