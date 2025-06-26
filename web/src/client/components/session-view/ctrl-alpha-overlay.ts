/**
 * Ctrl+Alpha Overlay Component
 *
 * Full-screen overlay for building Ctrl key sequences on mobile devices.
 * Allows users to create complex sequences like ctrl+c ctrl+c.
 */
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ctrl-alpha-overlay')
export class CtrlAlphaOverlay extends LitElement {
  // Disable shadow DOM to use Tailwind
  createRenderRoot() {
    return this;
  }

  @property({ type: Boolean }) visible = false;
  @property({ type: Array }) ctrlSequence: string[] = [];
  @property({ type: Number }) keyboardHeight = 0;
  @property({ type: Function }) onCtrlKey?: (letter: string) => void;
  @property({ type: Function }) onSendSequence?: () => void;
  @property({ type: Function }) onClearSequence?: () => void;
  @property({ type: Function }) onCancel?: () => void;

  private handleBackdropClick(e: Event) {
    if (e.target === e.currentTarget) {
      this.onCancel?.();
    }
  }

  private handleCtrlKey(letter: string) {
    this.onCtrlKey?.(letter);
  }

  render() {
    if (!this.visible) return null;

    return html`
      <div
        class="fixed inset-0 z-50 flex flex-col"
        style="background: rgba(0, 0, 0, 0.8);"
        @click=${this.handleBackdropClick}
      >
        <!-- Spacer to push content up above keyboard -->
        <div class="flex-1"></div>
        
        <div
          class="font-mono text-sm mx-4 max-w-sm w-full self-center"
          style="background: black; border: 1px solid #569cd6; border-radius: 8px; padding: 10px; margin-bottom: ${this.keyboardHeight > 0 ? `${this.keyboardHeight + 180}px` : 'calc(env(keyboard-inset-height, 0px) + 180px)'};/* 180px = estimated quick keyboard height (3 rows) */"
          @click=${(e: Event) => e.stopPropagation()}
        >
          <div class="text-vs-user text-center mb-2 font-bold">Ctrl + Key</div>

          <!-- Help text -->
          <div class="text-xs text-vs-muted text-center mb-3 opacity-70">
            Build sequences like ctrl+c ctrl+c
          </div>

          <!-- Current sequence display -->
          ${
            this.ctrlSequence.length > 0
              ? html`
                <div class="text-center mb-4 p-2 border border-vs-muted rounded bg-vs-bg">
                  <div class="text-xs text-vs-muted mb-1">Current sequence:</div>
                  <div class="text-sm text-vs-accent font-bold">
                    ${this.ctrlSequence.map((letter) => `Ctrl+${letter}`).join(' ')}
                  </div>
                </div>
              `
              : ''
          }

          <!-- Grid of A-Z buttons -->
          <div class="grid grid-cols-6 gap-1 mb-3">
            ${[
              'A',
              'B',
              'C',
              'D',
              'E',
              'F',
              'G',
              'H',
              'I',
              'J',
              'K',
              'L',
              'M',
              'N',
              'O',
              'P',
              'Q',
              'R',
              'S',
              'T',
              'U',
              'V',
              'W',
              'X',
              'Y',
              'Z',
            ].map(
              (letter) => html`
                <button
                  class="font-mono text-xs transition-all cursor-pointer aspect-square flex items-center justify-center quick-start-btn py-2"
                  @click=${() => this.handleCtrlKey(letter)}
                >
                  ${letter}
                </button>
              `
            )}
          </div>

          <!-- Common shortcuts info -->
          <div class="text-xs text-vs-muted text-center mb-3">
            <div>Common: C=interrupt, X=exit, O=save, W=search</div>
          </div>

          <!-- Action buttons -->
          <div class="flex gap-2 justify-center">
            <button
              class="font-mono px-4 py-2 text-sm transition-all cursor-pointer btn-ghost"
              @click=${() => this.onCancel?.()}
            >
              CANCEL
            </button>
            ${
              this.ctrlSequence.length > 0
                ? html`
                  <button
                    class="font-mono px-3 py-2 text-sm transition-all cursor-pointer btn-ghost"
                    @click=${() => this.onClearSequence?.()}
                  >
                    CLEAR
                  </button>
                  <button
                    class="font-mono px-3 py-2 text-sm transition-all cursor-pointer btn-secondary"
                    @click=${() => this.onSendSequence?.()}
                  >
                    SEND
                  </button>
                `
                : ''
            }
          </div>
        </div>
      </div>
    `;
  }
}
