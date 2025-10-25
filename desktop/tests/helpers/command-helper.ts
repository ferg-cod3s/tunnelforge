/**
 * CommandHelper - Tauri Command Execution and Validation
 * 
 * Provides comprehensive functionality for executing Tauri commands,
 * handling responses, validating results, and managing command lifecycle.
 */

import { Page, BrowserContext, TestInfo } from '@playwright/test';
import { promisify } from 'util';
import { 
  TauriCommand, 
  CommandResult, 
  TestError,
  HelperConfig
} from './types';
import { createTestError, sleep } from './utils';

const sleep = promisify(setTimeout);

export class CommandHelper {
  private page: Page;
  private context: BrowserContext;
  private testInfo: TestInfo;
  private config: HelperConfig;
  private commandHistory: CommandResult[] = [];
  private commandQueue: TauriCommand[] = [];

  constructor(
    page: Page,
    context: BrowserContext,
    testInfo: TestInfo,
    debugPort: number = 9222,
    config: Partial<HelperConfig> = {}
  ) {
    this.page = page;
    this.context = context;
    this.testInfo = testInfo;
    this.config = {
      debugPort,
      timeout: 15000,
      retries: 2,
      screenshotOnFailure: true,
      videoRecording: false,
      traceRecording: false,
      logLevel: 'info',
      tempDir: 'test-results/temp',
      ...config
    };
  }

  /**
   * Execute a Tauri command with comprehensive error handling and logging
   */
  async executeCommand<T = any>(
    command: string, 
    args: any[] = [], 
    options: { 
      timeout?: number; 
      retries?: number; 
      validate?: (result: T) => boolean;
      expect?: any;
    } = {}
  ): Promise<CommandResult<T>> {
    const { 
      timeout = this.config.timeout, 
      retries = this.config.retries,
      validate,
      expect
    } = options;
    
    const startTime = Date.now();
    console.log(`🔧 Executing Tauri command: ${command}`, args);
    
    let lastError: Error;
    let attempt = 0;
    
    for (attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.page.evaluate(
          async ([cmd, cmdArgs, cmdTimeout]) => {
            return new Promise((resolve, reject) => {
              const timeoutId = setTimeout(() => {
                reject(new Error(`Command timeout: ${cmd} after ${cmdTimeout}ms`));
              }, cmdTimeout);
              
              window.__TAURI__.invoke(cmd, ...cmdArgs)
                .then(result => {
                  clearTimeout(timeoutId);
                  resolve(result);
                })
                .catch(error => {
                  clearTimeout(timeoutId);
                  reject(error);
                });
            });
          },
          [command, args, timeout]
        );
        
        const executionTime = Date.now() - startTime;
        
        // Validate result if validation function provided
        if (validate && !validate(result as T)) {
          throw new Error(`Command validation failed: ${command}`);
        }
        
        // Check expected result if provided
        if (expect !== undefined) {
          if (JSON.stringify(result) !== JSON.stringify(expect)) {
            throw new Error(`Command result mismatch. Expected: ${JSON.stringify(expect)}, Got: ${JSON.stringify(result)}`);
          }
        }
        
        const commandResult: CommandResult<T> = {
          success: true,
          data: result as T,
          executionTime,
          attempt: attempt + 1
        };
        
        this.commandHistory.push(commandResult);
        console.log(`✅ Command succeeded: ${command} (${executionTime}ms)`, result);
        
        return commandResult;
        
      } catch (error) {
        lastError = error as Error;
        console.warn(`⚠️ Command attempt ${attempt + 1} failed: ${command}`, error);
        
        if (attempt < retries) {
          await sleep(1000); // Wait before retry
        }
      }
    }
    
    // All attempts failed
    const executionTime = Date.now() - startTime;
    const commandResult: CommandResult = {
      success: false,
      error: lastError.message,
      executionTime,
      attempt: attempt + 1
    };
    
    this.commandHistory.push(commandResult);
    console.error(`❌ Command failed after ${retries + 1} attempts: ${command}`, lastError);
    
    // Capture failure state if configured
    if (this.config.screenshotOnFailure) {
      await this.captureCommandFailure(command, args, lastError);
    }
    
    return commandResult;
  }

  /**
   * Execute multiple commands in sequence
   */
  async executeCommands(commands: TauriCommand[]): Promise<CommandResult[]> {
    console.log(`🔧 Executing ${commands.length} commands in sequence...`);
    
    const results: CommandResult[] = [];
    
    for (const command of commands) {
      const result = await this.executeCommand(
        command.command,
        command.args || [],
        {
          timeout: command.timeout,
          retries: command.retries,
          expect: command.expect
        }
      );
      
      results.push(result);
      
      // Stop execution if a command fails
      if (!result.success) {
        console.error(`❌ Command sequence stopped at failed command: ${command.command}`);
        break;
      }
    }
    
    return results;
  }

  /**
   * Execute commands in parallel
   */
  async executeCommandsParallel(commands: TauriCommand[]): Promise<CommandResult[]> {
    console.log(`🔧 Executing ${commands.length} commands in parallel...`);
    
    const promises = commands.map(command => 
      this.executeCommand(
        command.command,
        command.args || [],
        {
          timeout: command.timeout,
          retries: command.retries,
          expect: command.expect
        }
      )
    );
    
    const results = await Promise.all(promises);
    
    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Parallel execution completed: ${successCount}/${results.length} commands succeeded`);
    
    return results;
  }

  /**
   * Queue a command for later execution
   */
  queueCommand(command: TauriCommand): void {
    this.commandQueue.push(command);
    console.log(`📋 Command queued: ${command.command}`);
  }

  /**
   * Execute all queued commands
   */
  async executeQueuedCommands(): Promise<CommandResult[]> {
    console.log(`🚀 Executing ${this.commandQueue.length} queued commands...`);
    
    const commands = [...this.commandQueue];
    this.commandQueue = [];
    
    return await this.executeCommands(commands);
  }

  /**
   * Execute a command and expect it to fail
   */
  async expectCommandFailure(
    command: string, 
    args: any[] = [], 
    expectedError?: string
  ): Promise<CommandResult> {
    console.log(`❌ Expecting command to fail: ${command}`);
    
    const result = await this.executeCommand(command, args);
    
    if (result.success) {
      throw createTestError(
        `Expected command to fail but it succeeded: ${command}`,
        'EXPECTED_FAILURE',
        { command, args, result: result.data }
      );
    }
    
    if (expectedError && !result.error?.includes(expectedError)) {
      throw createTestError(
        `Expected error message to contain "${expectedError}" but got "${result.error}"`,
        'ERROR_MISMATCH',
        { command, args, actualError: result.error, expectedError }
      );
    }
    
    console.log(`✅ Command failed as expected: ${command} - ${result.error}`);
    return result;
  }

  /**
   * Execute a command with retry on specific conditions
   */
  async executeCommandWithRetry<T = any>(
    command: string,
    args: any[] = [],
    shouldRetry: (error: Error, attempt: number) => boolean,
    maxRetries: number = 5
  ): Promise<CommandResult<T>> {
    console.log(`🔄 Executing command with conditional retry: ${command}`);
    
    let attempt = 0;
    let lastError: Error;
    
    while (attempt <= maxRetries) {
      try {
        const result = await this.executeCommand<T>(command, args, { retries: 0 });
        
        if (result.success) {
          console.log(`✅ Command succeeded on attempt ${attempt + 1}: ${command}`);
          return result;
        }
        
        lastError = new Error(result.error || 'Unknown error');
        
      } catch (error) {
        lastError = error as Error;
      }
      
      attempt++;
      
      if (attempt <= maxRetries && shouldRetry(lastError, attempt)) {
        console.log(`🔄 Retrying command ${command} (attempt ${attempt + 1}/${maxRetries + 1})`);
        await sleep(1000 * attempt); // Exponential backoff
      } else {
        break;
      }
    }
    
    const executionTime = Date.now();
    const result: CommandResult = {
      success: false,
      error: lastError.message,
      executionTime,
      attempt
    };
    
    this.commandHistory.push(result);
    console.error(`❌ Command failed after ${attempt} attempts: ${command}`, lastError);
    
    return result;
  }

  /**
   * Batch execute commands with progress tracking
   */
  async executeBatchCommands(
    commands: TauriCommand[],
    onProgress?: (completed: number, total: number, result: CommandResult) => void
  ): Promise<CommandResult[]> {
    console.log(`📦 Executing batch of ${commands.length} commands...`);
    
    const results: CommandResult[] = [];
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      const result = await this.executeCommand(
        command.command,
        command.args || [],
        {
          timeout: command.timeout,
          retries: command.retries,
          expect: command.expect
        }
      );
      
      results.push(result);
      
      if (onProgress) {
        onProgress(i + 1, commands.length, result);
      }
      
      // Stop on first failure if configured
      if (!result.success) {
        console.error(`❌ Batch execution stopped at command ${i + 1}: ${command.command}`);
        break;
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Batch execution completed: ${successCount}/${results.length} commands succeeded`);
    
    return results;
  }

  /**
   * Get command execution history
   */
  getCommandHistory(): CommandResult[] {
    return [...this.commandHistory];
  }

  /**
   * Get command execution statistics
   */
  getCommandStats(): {
    total: number;
    successful: number;
    failed: number;
    averageExecutionTime: number;
    slowestCommand: { command: string; time: number };
    fastestCommand: { command: string; time: number };
  } {
    const total = this.commandHistory.length;
    const successful = this.commandHistory.filter(r => r.success).length;
    const failed = total - successful;
    
    const executionTimes = this.commandHistory
      .filter(r => r.success)
      .map(r => r.executionTime);
    
    const averageExecutionTime = executionTimes.length > 0 
      ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length 
      : 0;
    
    const slowestCommand = this.commandHistory
      .filter(r => r.success)
      .reduce((prev, current) => 
        prev.executionTime > current.executionTime ? prev : current,
        { command: 'none', executionTime: 0 }
      );
    
    const fastestCommand = this.commandHistory
      .filter(r => r.success)
      .reduce((prev, current) => 
        prev.executionTime < current.executionTime ? prev : current,
        { command: 'none', executionTime: Infinity }
      );
    
    return {
      total,
      successful,
      failed,
      averageExecutionTime,
      slowestCommand,
      fastestCommand
    };
  }

  /**
   * Clear command history
   */
  clearCommandHistory(): void {
    this.commandHistory = [];
    console.log('🗑️ Command history cleared');
  }

  /**
   * Validate command availability
   */
  async validateCommand(command: string): Promise<boolean> {
    try {
      const result = await this.executeCommand(command, [], { timeout: 5000, retries: 0 });
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Get available commands (if supported by the app)
   */
  async getAvailableCommands(): Promise<string[]> {
    try {
      const commands = await this.page.evaluate(() => {
        // This would need to be implemented in the Tauri app
        return window.__TAURI__?.invoke?.('get_available_commands') || [];
      });
      
      return commands;
    } catch {
      console.warn('⚠️ Unable to retrieve available commands');
      return [];
    }
  }

  /**
   * Execute a command with timeout and cancellation
   */
  async executeCommandWithCancellation<T = any>(
    command: string,
    args: any[] = [],
    cancellationToken: { cancelled: boolean }
  ): Promise<CommandResult<T>> {
    console.log(`⏹️ Executing command with cancellation: ${command}`);
    
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const execute = async () => {
        try {
          const result = await this.executeCommand<T>(command, args, { retries: 0 });
          resolve(result);
        } catch (error) {
          resolve({
            success: false,
            error: (error as Error).message,
            executionTime: Date.now() - startTime,
            attempt: 1
          });
        }
      };
      
      const checkCancellation = () => {
        if (cancellationToken.cancelled) {
          resolve({
            success: false,
            error: 'Command cancelled',
            executionTime: Date.now() - startTime,
            attempt: 1
          });
          return;
        }
        
        setTimeout(checkCancellation, 100);
      };
      
      execute();
      checkCancellation();
    });
  }

  // Private helper methods

  private async captureCommandFailure(command: string, args: any[], error: Error): Promise<void> {
    try {
      const screenshotPath = `test-results/command-failures/${command}-${Date.now()}.png`;
      
      await this.page.screenshot({ 
        path: screenshotPath,
        fullPage: true 
      });
      
      console.log(`📸 Command failure screenshot saved: ${screenshotPath}`);
      
      // Attach to test info
      this.testInfo.attachments.push({
        name: `command-failure-${command}`,
        path: screenshotPath,
        contentType: 'image/png'
      });
      
    } catch (screenshotError) {
      console.warn('⚠️ Failed to capture command failure screenshot:', screenshotError);
    }
  }
}