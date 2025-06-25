/**
 * Session Card Component
 *
 * Displays a single terminal session with its preview, status, and controls.
 * Shows activity indicators when terminal content changes and provides kill functionality.
 *
 * @fires session-select - When card is clicked (detail: Session)
 * @fires session-killed - When session is successfully killed (detail: { sessionId: string, session: Session })
 * @fires session-kill-error - When kill operation fails (detail: { sessionId: string, error: string })
 *
 * @listens content-changed - From vibe-terminal-buffer when terminal content changes
 */
import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Session } from '../../shared/types.js';
import type { AuthClient } from '../services/auth-client.js';
import { createLogger } from '../utils/logger.js';
import { copyToClipboard } from '../utils/path-utils.js';

const logger = createLogger('session-card');
import './vibe-terminal-buffer.js';
import './copy-icon.js';
import './clickable-path.js';

@customElement('session-card')
export class SessionCard extends LitElement {
  // Disable shadow DOM to use Tailwind
  createRenderRoot() {
    return this;
  }

  @property({ type: Object }) session!: Session;
  @property({ type: Object }) authClient!: AuthClient;
  @state() private killing = false;
  @state() private killingFrame = 0;
  @state() private isActive = false;

  private killingInterval: number | null = null;
  private activityTimeout: number | null = null;

  connectedCallback() {
    super.connectedCallback();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.killingInterval) {
      clearInterval(this.killingInterval);
    }
    if (this.activityTimeout) {
      clearTimeout(this.activityTimeout);
    }
  }

  private handleCardClick() {
    this.dispatchEvent(
      new CustomEvent('session-select', {
        detail: this.session,
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleContentChanged() {
    // Only track activity for running sessions
    if (this.session.status !== 'running') {
      return;
    }

    // Content changed, immediately mark as active
    this.isActive = true;

    // Clear existing timeout
    if (this.activityTimeout) {
      clearTimeout(this.activityTimeout);
    }

    // Set timeout to clear activity after 500ms of no changes
    this.activityTimeout = window.setTimeout(() => {
      this.isActive = false;
      this.activityTimeout = null;
    }, 500);
  }

  private async handleKillClick(e: Event) {
    e.stopPropagation();
    e.preventDefault();
    await this.kill();
  }

  // Public method to kill the session with animation (or clean up exited session)
  public async kill(): Promise<boolean> {
    // Don't kill if already killing
    if (this.killing) {
      return false;
    }

    // Only allow killing/cleanup for running or exited sessions
    if (this.session.status !== 'running' && this.session.status !== 'exited') {
      return false;
    }

    // Check if this is a cleanup action (for black hole animation)
    const isCleanup = this.session.status === 'exited';

    // Start killing animation
    this.killing = true;
    this.killingFrame = 0;
    this.killingInterval = window.setInterval(() => {
      this.killingFrame = (this.killingFrame + 1) % 4;
      this.requestUpdate();
    }, 200);

    // If cleanup, apply black hole animation FIRST and wait
    if (isCleanup) {
      // Apply the black hole animation class
      (this as HTMLElement).classList.add('black-hole-collapsing');

      // Wait for the animation to complete (300ms)
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Send kill or cleanup request based on session status
    try {
      // Use different endpoint based on session status
      const endpoint =
        this.session.status === 'exited'
          ? `/api/sessions/${this.session.id}/cleanup`
          : `/api/sessions/${this.session.id}`;

      const action = this.session.status === 'exited' ? 'cleanup' : 'kill';

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          ...this.authClient.getAuthHeader(),
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        logger.error(`Failed to ${action} session`, { errorData, sessionId: this.session.id });
        throw new Error(`${action} failed: ${response.status}`);
      }

      // Kill/cleanup succeeded - dispatch event to notify parent components
      this.dispatchEvent(
        new CustomEvent('session-killed', {
          detail: {
            sessionId: this.session.id,
            session: this.session,
          },
          bubbles: true,
          composed: true,
        })
      );

      logger.log(
        `Session ${this.session.id} ${action === 'cleanup' ? 'cleaned up' : 'killed'} successfully`
      );
      return true;
    } catch (error) {
      logger.error('Error killing session', { error, sessionId: this.session.id });

      // Show error to user (keep animation to indicate something went wrong)
      this.dispatchEvent(
        new CustomEvent('session-kill-error', {
          detail: {
            sessionId: this.session.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          bubbles: true,
          composed: true,
        })
      );
      return false;
    } finally {
      // Stop animation in all cases
      this.stopKillingAnimation();
    }
  }

  private stopKillingAnimation() {
    this.killing = false;
    if (this.killingInterval) {
      clearInterval(this.killingInterval);
      this.killingInterval = null;
    }
  }

  private getKillingText(): string {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    return frames[this.killingFrame % frames.length];
  }

  private async handlePidClick(e: Event) {
    e.stopPropagation();
    e.preventDefault();

    if (this.session.pid) {
      const success = await copyToClipboard(this.session.pid.toString());
      if (success) {
        logger.log('PID copied to clipboard', { pid: this.session.pid });
      } else {
        logger.error('Failed to copy PID to clipboard', { pid: this.session.pid });
      }
    }
  }

  render() {
    // Debug logging to understand what's in the session
    if (!this.session.name) {
      logger.warn('Session missing name', {
        sessionId: this.session.id,
        name: this.session.name,
        command: this.session.command,
      });
    }

    return html`
      <div
        class="card cursor-pointer overflow-hidden flex flex-col h-full ${
          this.killing ? 'opacity-60' : ''
        } ${
          this.isActive && this.session.status === 'running'
            ? 'shadow-[0_0_0_2px_#00ff88] shadow-glow-green-sm'
            : ''
        }"
        style="view-transition-name: session-${this.session.id}; --session-id: session-${
          this.session.id
        }"
        data-session-id="${this.session.id}"
        @click=${this.handleCardClick}
      >
        <!-- Compact Header -->
        <div
          class="flex justify-between items-center px-3 py-2 border-b border-dark-border bg-dark-bg-secondary"
        >
          <div class="text-xs font-mono pr-2 flex-1 min-w-0 text-accent-green">
            <div class="truncate" title="${this.session.name || this.session.command.join(' ')}">
              ${this.session.name || this.session.command.join(' ')}
            </div>
          </div>
          ${
            this.session.status === 'running' || this.session.status === 'exited'
              ? html`
                <button
                  class="btn-ghost ${
                    this.session.status === 'running' ? 'text-status-error' : 'text-status-warning'
                  } disabled:opacity-50 flex-shrink-0 p-1 rounded-full hover:bg-opacity-20 transition-all ${
                    this.session.status === 'running'
                      ? 'hover:bg-status-error'
                      : 'hover:bg-status-warning'
                  }"
                  @click=${this.handleKillClick}
                  ?disabled=${this.killing}
                  title="${this.session.status === 'running' ? 'Kill session' : 'Clean up session'}"
                >
                  ${
                    this.killing
                      ? html`<span class="block w-5 h-5 flex items-center justify-center"
                        >${this.getKillingText()}</span
                      >`
                      : html`
                        <svg
                          class="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle cx="12" cy="12" r="10" stroke-width="2" />
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M15 9l-6 6m0-6l6 6"
                          />
                        </svg>
                      `
                  }
                </button>
              `
              : ''
          }
        </div>

        <!-- Terminal display (main content) -->
        <div
          class="session-preview bg-black overflow-hidden flex-1 ${
            this.session.status === 'exited' ? 'session-exited' : ''
          }"
        >
          ${
            this.killing
              ? html`
                <div class="w-full h-full flex items-center justify-center text-status-error">
                  <div class="text-center font-mono">
                    <div class="text-4xl mb-2">${this.getKillingText()}</div>
                    <div class="text-sm">Killing session...</div>
                  </div>
                </div>
              `
              : html`
                <vibe-terminal-buffer
                  .sessionId=${this.session.id}
                  class="w-full h-full"
                  style="pointer-events: none;"
                  @content-changed=${this.handleContentChanged}
                ></vibe-terminal-buffer>
              `
          }
        </div>

        <!-- Compact Footer -->
        <div
          class="px-3 py-2 text-dark-text-muted text-xs border-t border-dark-border bg-dark-bg-secondary"
        >
          <div class="flex justify-between items-center min-w-0">
            <span class="${this.getStatusColor()} text-xs flex items-center gap-1 flex-shrink-0">
              <div class="w-2 h-2 rounded-full ${this.getStatusDotColor()}"></div>
              ${this.getStatusText()}
              ${
                this.session.status === 'running' && this.isActive
                  ? html`<span class="text-accent-green animate-pulse ml-1">●</span>`
                  : ''
              }
            </span>
            ${
              this.session.pid
                ? html`
                  <span
                    class="cursor-pointer hover:text-accent-green transition-colors text-xs flex-shrink-0 ml-2 inline-flex items-center gap-1"
                    @click=${this.handlePidClick}
                    title="Click to copy PID"
                  >
                    PID: ${this.session.pid} <copy-icon size="14"></copy-icon>
                  </span>
                `
                : ''
            }
          </div>
          <div class="text-xs opacity-75 min-w-0 mt-1">
            <clickable-path .path=${this.session.workingDir} .iconSize=${12}></clickable-path>
          </div>
        </div>
      </div>
    `;
  }

  private getStatusText(): string {
    if (this.session.active === false) {
      return 'waiting';
    }
    return this.session.status;
  }

  private getStatusColor(): string {
    if (this.session.active === false) {
      return 'text-dark-text-muted';
    }
    return this.session.status === 'running' ? 'text-status-success' : 'text-status-warning';
  }

  private getStatusDotColor(): string {
    if (this.session.active === false) {
      return 'bg-dark-text-muted';
    }
    return this.session.status === 'running' ? 'bg-status-success' : 'bg-status-warning';
  }
}
