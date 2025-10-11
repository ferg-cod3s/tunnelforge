#!/usr/bin/env node
/**
 * Lighthouse Performance Baseline Measurement
 *
 * Measures current performance metrics to establish a baseline
 * before migrating to Astro/Svelte.
 */

import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import fs from 'fs';
import path from 'path';

const URLs_TO_TEST = [
  'http://localhost:4020',           // Main page
  'http://localhost:4020/app',       // App shell
];

async function runLighthouse(url) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  const options = {
    logLevel: 'info',
    output: 'json',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    port: chrome.port,
  };

  const runnerResult = await lighthouse(url, options);

  await chrome.kill();

  return runnerResult;
}

async function measureBaseline() {
  console.log('🚀 Starting Lighthouse baseline measurements...\n');

  const results = [];
  const timestamp = new Date().toISOString().split('T')[0];

  for (const url of URLs_TO_TEST) {
    console.log(`📊 Testing: ${url}`);

    try {
      const result = await runLighthouse(url);
      const { lhr } = result;

      const metrics = {
        url,
        timestamp,
        scores: {
          performance: Math.round(lhr.categories.performance.score * 100),
          accessibility: Math.round(lhr.categories.accessibility.score * 100),
          bestPractices: Math.round(lhr.categories['best-practices'].score * 100),
          seo: Math.round(lhr.categories.seo.score * 100),
        },
        metrics: {
          firstContentfulPaint: lhr.audits['first-contentful-paint'].numericValue,
          largestContentfulPaint: lhr.audits['largest-contentful-paint'].numericValue,
          totalBlockingTime: lhr.audits['total-blocking-time'].numericValue,
          cumulativeLayoutShift: lhr.audits['cumulative-layout-shift'].numericValue,
          speedIndex: lhr.audits['speed-index'].numericValue,
          timeToInteractive: lhr.audits['interactive'].numericValue,
        },
        sizes: {
          totalSize: lhr.audits['total-byte-weight'].numericValue,
          jsSize: lhr.audits['bootup-time']?.details?.items?.reduce((sum, item) =>
            sum + (item.scriptParseCompile || 0), 0) || 0,
        }
      };

      results.push(metrics);

      console.log(`  ✅ Performance: ${metrics.scores.performance}/100`);
      console.log(`  📦 Total Size: ${(metrics.sizes.totalSize / 1024).toFixed(2)} KB`);
      console.log(`  ⚡ FCP: ${metrics.metrics.firstContentfulPaint.toFixed(0)}ms`);
      console.log(`  🎨 LCP: ${metrics.metrics.largestContentfulPaint.toFixed(0)}ms`);
      console.log(`  ⏱️  TTI: ${metrics.metrics.timeToInteractive.toFixed(0)}ms\n`);

    } catch (error) {
      console.error(`  ❌ Error testing ${url}:`, error.message);
    }
  }

  // Save results
  const outputDir = path.join(process.cwd(), 'lighthouse-reports');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `baseline-${timestamp}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  console.log(`\n📁 Baseline saved to: ${outputPath}`);

  // Print summary
  console.log('\n📊 Summary:');
  results.forEach(r => {
    console.log(`\n${r.url}:`);
    console.log(`  Performance: ${r.scores.performance}/100`);
    console.log(`  Accessibility: ${r.scores.accessibility}/100`);
    console.log(`  Best Practices: ${r.scores.bestPractices}/100`);
    console.log(`  SEO: ${r.scores.seo}/100`);
  });

  // Check if we meet migration targets
  const avgPerformance = results.reduce((sum, r) => sum + r.scores.performance, 0) / results.length;

  console.log('\n🎯 Migration Targets:');
  console.log(`  Current Performance: ${avgPerformance.toFixed(0)}/100`);
  console.log(`  Target Performance: 90/100`);
  console.log(`  Bundle Size Reduction Target: 84% (420KB → 67KB)`);

  if (avgPerformance < 90) {
    console.log(`  ⚠️  Room for improvement: ${(90 - avgPerformance).toFixed(0)} points`);
  } else {
    console.log(`  ✅ Already meeting performance target!`);
  }
}

measureBaseline().catch(console.error);
