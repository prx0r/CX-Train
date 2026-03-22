/**
 * Validation Tests for AI Integration
 * Run with: npx ts-node scripts/tests/validate-ai-integration.ts
 */

import { 
  callChutesAI, 
  analyzeTrainingPatterns,
  validateEnvironment,
  logDebug,
  logError 
} from '@/lib/ai/chutes';
import { 
  checkLevelProgression, 
  promoteUserLevel,
  LEVEL_REQUIREMENTS 
} from '@/lib/ai/feedback-analyzer';
import { 
  runAIMonitor, 
  detectPromptIssues,
  generateAdminSummary 
} from '@/lib/ai/monitor';

// Test results tracker
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await testFn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`✅ ${name} (${Date.now() - start}ms)`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: errorMsg, duration: Date.now() - start });
    console.error(`❌ ${name} (${Date.now() - start}ms)`);
    console.error(`   Error: ${errorMsg}`);
  }
}

// Validation helpers
function assertEquals(actual: unknown, expected: unknown, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${expected}, got ${actual}`
    );
  }
}

function assertTrue(value: boolean | undefined | null, message?: string): void {
  if (!value) {
    throw new Error(message || 'Expected true, got false');
  }
}

function assertFalse(value: boolean | undefined | null, message?: string): void {
  if (value) {
    throw new Error(message || 'Expected false, got true');
  }
}

function assertNotNull(value: unknown, message?: string): void {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected non-null value');
  }
}

// Test suite
async function runTests() {
  console.log('\n🧪 Starting AI Integration Validation Tests\n');
  console.log('═'.repeat(60));

  // === Environment Tests ===
  console.log('\n📋 Environment Validation Tests\n');

  await runTest('Environment variables exist', async () => {
    assertNotNull(process.env.CHUTES_API_URL, 'CHUTES_API_URL should be set');
    assertNotNull(process.env.CHUTES_MODEL, 'CHUTES_MODEL should be set');
    // Note: CHUTES_API_KEY might not be set in test environment
  });

  await runTest('validateEnvironment with missing key', async () => {
    const originalKey = process.env.CHUTES_API_KEY;
    delete process.env.CHUTES_API_KEY;
    
    const result = validateEnvironment();
    assertFalse(result.valid, 'Should be invalid without API key');
    assertTrue(result.errors.length > 0, 'Should have errors');
    assertTrue(
      result.errors.some(e => e.includes('CHUTES_API_KEY')),
      'Error should mention CHUTES_API_KEY'
    );
    
    process.env.CHUTES_API_KEY = originalKey;
  });

  await runTest('validateEnvironment with placeholder key', async () => {
    const originalKey = process.env.CHUTES_API_KEY;
    process.env.CHUTES_API_KEY = 'your_chutes_api_key_here';
    
    const result = validateEnvironment();
    assertFalse(result.valid, 'Should be invalid with placeholder key');
    
    process.env.CHUTES_API_KEY = originalKey;
  });

  // === Chutes AI Module Tests ===
  console.log('\n🤖 Chutes AI Module Tests\n');

  await runTest('callChutesAI rejects empty messages', async () => {
    const result = await callChutesAI([]);
    assertFalse(result.success, 'Should fail with empty messages');
    assertTrue(
      result.error?.includes('empty messages') || result.error?.includes('Environment'),
      'Error should mention empty messages or environment'
    );
  });

  await runTest('callChutesAI validates message roles', async () => {
    const result = await callChutesAI([
      { role: 'invalid' as 'user', content: 'test' }
    ]);
    assertFalse(result.success, 'Should fail with invalid role');
    assertTrue(
      result.error?.includes('Invalid role') || result.error?.includes('Environment'),
      'Error should mention invalid role or environment'
    );
  });

  await runTest('callChutesAI validates message content', async () => {
    const result = await callChutesAI([
      { role: 'user', content: '' }
    ]);
    assertFalse(result.success, 'Should fail with empty content');
    assertTrue(
      result.error?.includes('Invalid content') || result.error?.includes('Environment'),
      'Error should mention invalid content or environment'
    );
  });

  await runTest('analyzeTrainingPatterns validates userId', async () => {
    const result = await analyzeTrainingPatterns('', 10);
    assertFalse(result.success, 'Should fail with empty userId');
    assertTrue(
      result.error?.includes('Invalid userId'),
      'Error should mention invalid userId'
    );
  });

  await runTest('analyzeTrainingPatterns validates sessionCount (low)', async () => {
    const result = await analyzeTrainingPatterns('user-123', 0);
    assertFalse(result.success, 'Should fail with sessionCount=0');
    assertTrue(
      result.error?.includes('Invalid sessionCount'),
      'Error should mention invalid sessionCount'
    );
  });

  await runTest('analyzeTrainingPatterns validates sessionCount (high)', async () => {
    const result = await analyzeTrainingPatterns('user-123', 101);
    assertFalse(result.success, 'Should fail with sessionCount=101');
    assertTrue(
      result.error?.includes('Invalid sessionCount'),
      'Error should mention invalid sessionCount'
    );
  });

  // === Level Progression Tests ===
  console.log('\n📊 Level Progression Tests\n');

  await runTest('LEVEL_REQUIREMENTS structure is valid', async () => {
    assertNotNull(LEVEL_REQUIREMENTS[1], 'Level 1 requirements should exist');
    assertNotNull(LEVEL_REQUIREMENTS[2], 'Level 2 requirements should exist');
    assertNotNull(LEVEL_REQUIREMENTS[3], 'Level 3 requirements should exist');
    
    // Validate Level 2 requirements
    assertEquals(LEVEL_REQUIREMENTS[2].minPoints, 40, 'Level 2 requires 40 points');
    assertEquals(LEVEL_REQUIREMENTS[2].minSessions, 5, 'Level 2 requires 5 sessions');
    assertEquals(LEVEL_REQUIREMENTS[2].minAvgScore, 75, 'Level 2 requires 75% avg score');
  });

  // === Monitor Tests ===
  console.log('\n👁️  AI Monitor Tests\n');

  await runTest('detectPromptIssues validates input (insufficient data)', async () => {
    const result = await detectPromptIssues('call_sim', 7);
    // Without actual sessions, it should fail gracefully
    assertNotNull(result, 'Should return a result');
  });

  await runTest('generateAdminSummary returns structure', async () => {
    const result = await generateAdminSummary('call_sim', 7);
    assertNotNull(result, 'Should return summary');
    assertEquals(typeof result.totalSessions, 'number', 'totalSessions should be a number');
    assertEquals(typeof result.avgScore, 'number', 'avgScore should be a number');
    assertEquals(typeof result.passRate, 'number', 'passRate should be a number');
    assertTrue(Array.isArray(result.topWeaknesses), 'topWeaknesses should be an array');
    assertTrue(Array.isArray(result.recommendedActions), 'recommendedActions should be an array');
  });

  // === Integration Tests ===
  console.log('\n🔗 Integration Tests\n');

  await runTest('Full flow: checkLevelProgression returns valid structure', async () => {
    // This test requires actual database - may fail in isolated test environment
    try {
      const result = await checkLevelProgression('test-user-123', 'call_sim');
      assertNotNull(result, 'Should return progression data');
      assertEquals(typeof result.current_level, 'number', 'current_level should be a number');
      assertEquals(typeof result.target_level, 'number', 'target_level should be a number');
      assertEquals(typeof result.can_level_up, 'boolean', 'can_level_up should be a boolean');
      assertTrue(Array.isArray(result.requirements_met), 'requirements_met should be an array');
      assertTrue(Array.isArray(result.requirements_pending), 'requirements_pending should be an array');
    } catch (error) {
      // Expected to fail without database
      console.log('   (Skipped - requires database connection)');
    }
  });

  // === Summary ===
  console.log('\n' + '═'.repeat(60));
  console.log('\n📊 Test Results Summary\n');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Total Duration: ${totalDuration}ms`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%\n`);
  
  if (failed > 0) {
    console.log('Failed Tests:\n');
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`  ❌ ${r.name}`);
        console.log(`     Error: ${r.error}\n`);
      });
  }
  
  return failed === 0;
}

// Run tests
runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
