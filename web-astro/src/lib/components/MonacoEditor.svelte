<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { authToken } from '$lib/stores/auth';
  import { getTerminalPreferences } from '$lib/services/settings';
  import { initializeMonaco, ensureMonacoLoaded } from '$lib/utils/monaco-loader';
  import { createLogger } from '$lib/utils/logger';
  import type * as Monaco from 'monaco-editor';

  const logger = createLogger('monaco-editor');

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    'content-changed': { content: string };
    save: { content: string };
    error: { error: string };
  }>();

  // Props interface
  interface Props {
    sessionId: string;
    filePath: string;
    readOnly?: boolean;
    theme?: 'vs-dark' | 'vs-light';
    fontSize?: number;
    autoSave?: boolean;
    autoSaveDelay?: number;
  }

  let {
    sessionId,
    filePath,
    readOnly = false,
    theme = 'vs-dark',
    fontSize = 14,
    autoSave = false,
    autoSaveDelay = 1000
  }: Props = $props();

  // Svelte 5 state
  let containerRef = $state<HTMLDivElement | null>(null);
  let editor: Monaco.editor.IStandaloneCodeEditor | null = $state(null);
  let isLoading = $state(true);
  let content = $state('');
  let isDirty = $state(false);
  let autoSaveTimer = $state<ReturnType<typeof setTimeout> | null>(null);
  let resizeObserver = $state<ResizeObserver | null>(null);

  // Derived state
  let effectiveTheme = $derived(theme === 'vs-dark' ? 'vs-dark' : 'vs');
  let effectiveFontSize = $derived(fontSize || getTerminalPreferences().fontSize);

  // Language detection from file extension
  function detectLanguage(filename: string): string {
    if (!filename) return 'plaintext';

    const ext = filename.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      json: 'json',
      html: 'html',
      htm: 'html',
      css: 'css',
      scss: 'scss',
      sass: 'sass',
      less: 'less',
      py: 'python',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      cs: 'csharp',
      php: 'php',
      swift: 'swift',
      kt: 'kotlin',
      scala: 'scala',
      r: 'r',
      sql: 'sql',
      sh: 'shell',
      bash: 'shell',
      zsh: 'shell',
      fish: 'shell',
      ps1: 'powershell',
      yml: 'yaml',
      yaml: 'yaml',
      xml: 'xml',
      md: 'markdown',
      markdown: 'markdown',
      dockerfile: 'dockerfile',
      makefile: 'makefile',
      gitignore: 'gitignore',
    };

    return languageMap[ext || ''] || 'plaintext';
  }

  // Load file content from API
  async function loadFileContent(): Promise<void> {
    if (!sessionId || !filePath) return;

    try {
      const token = $authToken;
      const response = await fetch(`/api/sessions/${sessionId}/files?path=${encodeURIComponent(filePath)}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error(`Failed to load file: ${response.status}`);
      }

      const data = await response.json();
      content = data.content || '';
      isDirty = false;

      logger.log(`Loaded file: ${filePath}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to load file';
      logger.error(`Failed to load file ${filePath}:`, error);
      dispatch('error', { error: errorMsg });
    }
  }

  // Save file content to API
  async function saveFileContent(): Promise<void> {
    if (!sessionId || !filePath || !editor) return;

    try {
      const currentContent = editor.getValue();
      const token = $authToken;

      const response = await fetch(`/api/sessions/${sessionId}/files?path=${encodeURIComponent(filePath)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content: currentContent }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save file: ${response.status}`);
      }

      isDirty = false;
      dispatch('save', { content: currentContent });
      logger.log(`Saved file: ${filePath}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to save file';
      logger.error(`Failed to save file ${filePath}:`, error);
      dispatch('error', { error: errorMsg });
    }
  }

  // Setup auto-save
  function setupAutoSave(): void {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    if (autoSave && isDirty) {
      autoSaveTimer = setTimeout(() => {
        saveFileContent();
      }, autoSaveDelay);
    }
  }

  // Handle content changes
  function handleContentChange(): void {
    if (!editor) return;

    const newContent = editor.getValue();
    const wasDirty = isDirty;
    isDirty = newContent !== content;

    dispatch('content-changed', { content: newContent });

    // Setup auto-save if content became dirty
    if (isDirty && !wasDirty && autoSave) {
      setupAutoSave();
    }
  }

  // Handle save command (Ctrl/Cmd + S)
  function handleSave(): void {
    if (readOnly) return;
    saveFileContent();
  }

  // Create Monaco editor instance
  async function createEditor(): Promise<void> {
    if (!containerRef) return;

    try {
      // Ensure Monaco is loaded
      const monaco = await ensureMonacoLoaded();

      // Set theme
      monaco.editor.setTheme(effectiveTheme);

      // Create editor options
      const options: Monaco.editor.IStandaloneEditorConstructionOptions = {
        value: content,
        language: detectLanguage(filePath),
        theme: effectiveTheme,
        readOnly,
        automaticLayout: true,
        fontSize: effectiveFontSize,
        fontFamily: "'Fira Code', Menlo, Monaco, 'Courier New', monospace",
        fontLigatures: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        renderWhitespace: 'selection',
        folding: true,
        foldingStrategy: 'indentation',
        foldingHighlight: true,
        showFoldingControls: 'always',
        renderLineHighlight: 'all',
        renderLineHighlightOnlyWhenFocus: false,
        wordWrap: 'on',
        tabSize: 2,
        insertSpaces: true,
        detectIndentation: true,
        trimAutoWhitespace: true,
        // Enable basic features
        lineNumbers: 'on',
        glyphMargin: false,
        lineDecorationsWidth: 10,
        lineNumbersMinChars: 3,
        // Context menu
        contextmenu: true,
        // Multi-cursor
        multiCursorModifier: 'ctrlCmd',
        // Find widget
        find: {
          addExtraSpaceOnTop: false,
          autoFindInSelection: 'never',
          seedSearchStringFromSelection: 'always',
        },
        // Suggestions
        quickSuggestions: {
          other: true,
          comments: true,
          strings: true,
        },
        parameterHints: {
          enabled: true,
        },
        // Hover
        hover: {
          enabled: true,
        },
        // Bracket matching
        matchBrackets: 'always',
        // Auto-closing
        autoClosingBrackets: 'always',
        autoClosingQuotes: 'always',
        autoSurround: 'languageDefined',
        // Format on paste/type
        formatOnPaste: true,
        formatOnType: true,
      };

      // Create editor
      editor = monaco.editor.create(containerRef, options);

      // Add save command
      if (!readOnly) {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, handleSave);

        // Listen for content changes
        editor.onDidChangeModelContent(handleContentChange);
      }

      // Setup resize observer
      resizeObserver = new ResizeObserver(() => {
        editor?.layout();
      });

      if (containerRef) {
        resizeObserver.observe(containerRef);
      }

      isLoading = false;
      logger.log(`Created Monaco editor for ${filePath}`);
    } catch (error) {
      logger.error('Failed to create Monaco editor:', error);
      dispatch('error', { error: 'Failed to create editor' });
      isLoading = false;
    }
  }

  // Update editor when props change
  $effect(() => {
    if (!editor) return;

    // Update theme
    if (editor) {
      // This will be handled by the theme observer in monaco-loader.ts
    }

    // Update read-only state
    editor.updateOptions({ readOnly });

    // Update font size
    editor.updateOptions({ fontSize: effectiveFontSize });
  });

  // Load file when sessionId or filePath changes
  $effect(() => {
    if (sessionId && filePath) {
      loadFileContent();
    }
  });

  // Initialize Monaco and create editor
  onMount(async () => {
    try {
      await initializeMonaco();
      await createEditor();
    } catch (error) {
      logger.error('Failed to initialize Monaco editor:', error);
      dispatch('error', { error: 'Failed to initialize editor' });
      isLoading = false;
    }
  });

  // Cleanup
  onDestroy(() => {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    if (resizeObserver) {
      resizeObserver.disconnect();
    }

    if (editor) {
      editor.dispose();
      editor = null;
    }
  });

  // Public methods (can be called via bind:this)
  export function getContent(): string {
    return editor?.getValue() || '';
  }

  export function setContent(newContent: string): void {
    if (editor) {
      editor.setValue(newContent);
      content = newContent;
      isDirty = false;
    }
  }

  export function focus(): void {
    editor?.focus();
  }

  export function save(): void {
    saveFileContent();
  }
</script>

<div class="monaco-editor-container" class:loading={isLoading}>
  <div
    bind:this={containerRef}
    class="monaco-editor"
    class:readonly={readOnly}
    class:dirty={isDirty}
    style="width: 100%; height: 100%; position: relative;"
  >
    {#if isLoading}
      <div class="loading-overlay">
        <div class="loading-spinner"></div>
        <div class="loading-text">Loading editor...</div>
      </div>
    {/if}
  </div>

  {#if isDirty && !readOnly}
    <div class="dirty-indicator" title="Unsaved changes">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
        <circle cx="12" cy="12" r="2" fill="currentColor"/>
      </svg>
    </div>
  {/if}
</div>

<style>
  .monaco-editor-container {
    position: relative;
    width: 100%;
    height: 100%;
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .monaco-editor {
    width: 100%;
    height: 100%;
    background: var(--color-bg);
  }

  .monaco-editor.readonly {
    opacity: 0.8;
  }

  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--color-bg);
    z-index: 10;
    color: var(--color-text-muted);
    font-family: ui-monospace, monospace;
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-border);
    border-top: 3px solid var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  .loading-text {
    font-size: var(--font-size-sm);
  }

  .dirty-indicator {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: var(--color-accent-orange);
    color: white;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-sm);
    z-index: 5;
  }

  .dirty-indicator svg {
    width: 12px;
    height: 12px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Monaco Editor customizations */
  :global(.monaco-editor .margin) {
    background: var(--color-bg-secondary) !important;
  }

  :global(.monaco-editor .monaco-editor-background) {
    background: var(--color-bg) !important;
  }

  :global(.monaco-editor .line-numbers) {
    color: var(--color-text-muted) !important;
  }

  :global(.monaco-editor .current-line) {
    background: rgba(var(--color-primary-rgb, 255 107 53), 0.1) !important;
  }

  :global(.monaco-editor .selectionHighlight) {
    background: rgba(var(--color-primary-rgb, 255 107 53), 0.2) !important;
  }

  /* Scrollbar styling */
  :global(.monaco-scrollable-element > .scrollbar > .slider) {
    background: var(--color-border) !important;
  }

  :global(.monaco-scrollable-element > .scrollbar > .slider:hover) {
    background: var(--color-text-muted) !important;
  }

  :global(.monaco-scrollable-element > .scrollbar > .slider.active) {
    background: var(--color-primary) !important;
  }

  /* Context menu */
  :global(.monaco-menu .action-item) {
    background: var(--color-bg-elevated) !important;
    color: var(--color-text) !important;
  }

  :global(.monaco-menu .action-item:hover) {
    background: var(--color-bg-secondary) !important;
  }

  :global(.monaco-menu .action-item.focused) {
    background: rgba(var(--color-primary-rgb, 255 107 53), 0.1) !important;
  }

  /* Find widget */
  :global(.monaco-find-widget) {
    background: var(--color-bg-elevated) !important;
    border: 1px solid var(--color-border) !important;
  }

  :global(.monaco-find-widget .monaco-inputbox) {
    background: var(--color-bg) !important;
    border: 1px solid var(--color-border) !important;
  }

  /* Suggestions widget */
  :global(.monaco-editor .suggest-widget) {
    background: var(--color-bg-elevated) !important;
    border: 1px solid var(--color-border) !important;
  }

  :global(.monaco-editor .suggest-widget .monaco-list-row) {
    background: transparent !important;
  }

  :global(.monaco-editor .suggest-widget .monaco-list-row:hover) {
    background: var(--color-bg-secondary) !important;
  }

  :global(.monaco-editor .suggest-widget .monaco-list-row.focused) {
    background: rgba(var(--color-primary-rgb, 255 107 53), 0.1) !important;
  }
</style>