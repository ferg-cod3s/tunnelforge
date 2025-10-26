<!--
  AutocompleteManager Component

  Terminal autocomplete component with fuzzy matching, keyboard navigation,
  and async suggestion fetching. Provides directory and repository completion
  for terminal input fields.

  @fires suggestion-selected - When a suggestion is selected (detail: { suggestion: string })
  @fires visibility-changed - When visibility changes (detail: { visible: boolean })

  @listens input-changed - From parent when input value changes
  @listens position-changed - From parent when cursor position changes
-->

<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { createLogger } from '$lib/utils/logger';
  import type { AutocompleteItem, Repository, AuthClient } from '$lib/types';

  const logger = createLogger('autocomplete-manager');

  // Props
  interface Props {
    visible?: boolean;
    inputValue?: string;
    position?: { top: number; left: number; width: number };
    authClient?: AuthClient;
    repositories?: Repository[];
    maxSuggestions?: number;
    debounceMs?: number;
  }

  let {
    visible = $bindable(false),
    inputValue = '',
    position = { top: 0, left: 0, width: 0 },
    authClient,
    repositories = [],
    maxSuggestions = 20,
    debounceMs = 300,
  }: Props = $props();

  // State
  let suggestions = $state<AutocompleteItem[]>([]);
  let filteredSuggestions = $state<AutocompleteItem[]>([]);
  let selectedIndex = $state(-1);
  let isLoading = $state(false);
  let searchTerm = $state('');
  let debounceTimer = $state<NodeJS.Timeout | undefined>();

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    'suggestion-selected': { suggestion: string };
    'visibility-changed': { visible: boolean };
  }>();

  // Fuzzy matching function
  function fuzzyMatch(text: string, pattern: string): boolean {
    if (!pattern) return true;

    const textLower = text.toLowerCase();
    const patternLower = pattern.toLowerCase();

    let patternIndex = 0;
    for (let i = 0; i < textLower.length && patternIndex < patternLower.length; i++) {
      if (textLower[i] === patternLower[patternIndex]) {
        patternIndex++;
      }
    }

    return patternIndex === patternLower.length;
  }

  // Filter suggestions based on search term
  function filterSuggestions(suggestions: AutocompleteItem[], term: string): AutocompleteItem[] {
    if (!term.trim()) return suggestions;

    return suggestions.filter(item => {
      const nameMatch = fuzzyMatch(item.name, term);
      const pathMatch = fuzzyMatch(item.path || item.suggestion, term);
      return nameMatch || pathMatch;
    });
  }

  // Sort suggestions with custom logic
  function sortSuggestions(suggestions: AutocompleteItem[], originalPath: string): AutocompleteItem[] {
    const searchTerm = originalPath.toLowerCase();
    const lastPathSegment = searchTerm.split('/').pop() || '';

    return suggestions.sort((a, b) => {
      // 1. Direct name matches come first
      const aNameMatch = a.name.toLowerCase() === lastPathSegment;
      const bNameMatch = b.name.toLowerCase() === lastPathSegment;
      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;

      // 2. Name starts with search term
      const aStartsWith = a.name.toLowerCase().startsWith(lastPathSegment);
      const bStartsWith = b.name.toLowerCase().startsWith(lastPathSegment);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      // 3. Git repositories before regular directories
      if (a.isRepository && !b.isRepository) return -1;
      if (!a.isRepository && b.isRepository) return 1;

      // 4. Alphabetical order
      return a.name.localeCompare(b.name);
    });
  }

  // Fetch filesystem completions from API
  async function fetchFilesystemCompletions(path: string): Promise<AutocompleteItem[]> {
    if (!path.trim()) return [];

    try {
      const headers: Record<string, string> = {};
      if (authClient) {
        const authHeader = authClient.getAuthHeader();
        if (typeof authHeader === 'string') {
          headers.Authorization = authHeader;
        } else {
          Object.assign(headers, authHeader);
        }
      }

      const response = await fetch(`/api/fs/completions?path=${encodeURIComponent(path)}`, {
        headers,
      });

      if (!response.ok) {
        logger.error('Failed to fetch completions');
        return [];
      }

      const data = await response.json();
      const completions: AutocompleteItem[] = data.completions || [];

      // Filter out files - only show directories and git repositories
      return completions.filter((item: AutocompleteItem) => item.type === 'directory');
    } catch (error) {
      logger.error('Error fetching completions:', error);
      return [];
    }
  }

  // Get repository suggestions
  function getRepositorySuggestions(path: string): AutocompleteItem[] {
    if (!path || repositories.length === 0) return [];

    // Check if user is searching by name (not full path)
    const isSearchingByName =
      !path.includes('/') ||
      ((path.match(/\//g) || []).length === 1 && !path.endsWith('/'));

    if (!isSearchingByName) return [];

    const searchTerm = path.toLowerCase().replace('~/', '');

    // Filter repositories that match the search term
    return repositories
      .filter((repo) => repo.folderName.toLowerCase().includes(searchTerm))
      .map((repo) => ({
        name: repo.folderName,
        path: repo.relativePath,
        type: 'directory' as const,
        suggestion: repo.path,
        isRepository: true,
        gitBranch: undefined, // Repository service doesn't provide this yet
      }));
  }

  // Fetch all suggestions
  async function fetchSuggestions(path: string): Promise<AutocompleteItem[]> {
    const [filesystemCompletions, repositoryCompletions] = await Promise.all([
      fetchFilesystemCompletions(path),
      Promise.resolve(getRepositorySuggestions(path)),
    ]);

    // Merge completions, avoiding duplicates
    const existingPaths = new Set(filesystemCompletions.map(c => c.suggestion));
    const uniqueRepos = repositoryCompletions.filter(repo => !existingPaths.has(repo.suggestion));

    const allCompletions = [...filesystemCompletions, ...uniqueRepos];

    // Sort and limit results
    const sortedCompletions = sortSuggestions(allCompletions, path);
    return sortedCompletions.slice(0, maxSuggestions);
  }

  // Update suggestions based on input
  async function updateSuggestions(input: string) {
    if (!input.trim()) {
      suggestions = [];
      filteredSuggestions = [];
      selectedIndex = -1;
      visible = false;
      dispatch('visibility-changed', { visible: false });
      return;
    }

    isLoading = true;

    try {
      suggestions = await fetchSuggestions(input);
      filteredSuggestions = filterSuggestions(suggestions, input);
      selectedIndex = filteredSuggestions.length > 0 ? 0 : -1;
      visible = filteredSuggestions.length > 0;
      dispatch('visibility-changed', { visible });
    } catch (error) {
      logger.error('Error updating suggestions:', error);
      suggestions = [];
      filteredSuggestions = [];
      selectedIndex = -1;
      visible = false;
      dispatch('visibility-changed', { visible: false });
    } finally {
      isLoading = false;
    }
  }

  // Debounced suggestion update
  function debouncedUpdateSuggestions(input: string) {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      updateSuggestions(input);
    }, debounceMs);
  }

  // Handle input value changes
  $effect(() => {
    if (inputValue !== searchTerm) {
      searchTerm = inputValue;
      debouncedUpdateSuggestions(inputValue);
    }
  });

  // Handle keyboard navigation
  function handleKeyDown(event: KeyboardEvent) {
    if (!visible || filteredSuggestions.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, filteredSuggestions.length - 1);
        break;

      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        break;

      case 'Enter':
      case 'Tab':
        if (selectedIndex >= 0 && filteredSuggestions[selectedIndex]) {
          event.preventDefault();
          selectSuggestion(filteredSuggestions[selectedIndex]);
        }
        break;

      case 'Escape':
        visible = false;
        selectedIndex = -1;
        dispatch('visibility-changed', { visible: false });
        break;
    }
  }

  // Select a suggestion
  function selectSuggestion(suggestion: AutocompleteItem) {
    dispatch('suggestion-selected', { suggestion: suggestion.suggestion });
    visible = false;
    selectedIndex = -1;
    dispatch('visibility-changed', { visible: false });
  }

  // Handle suggestion click
  function handleSuggestionClick(suggestion: AutocompleteItem) {
    selectSuggestion(suggestion);
  }

  // Cleanup on unmount
  onMount(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  });

  // Expose keyboard handler for parent components
  $effect(() => {
    // This allows parent components to call handleKeyDown
    (globalThis as any).autocompleteKeyDown = handleKeyDown;
  });
</script>

{#if visible}
  <div
    class="autocomplete-dropdown"
    class:loading={isLoading}
    style="
      position: absolute;
      top: {position.top}px;
      left: {position.left}px;
      width: {position.width}px;
      z-index: 1000;
    "
    role="listbox"
    aria-label="Autocomplete suggestions"
  >
    <div class="autocomplete-list">
      {#each filteredSuggestions as suggestion, index}
        <button
          type="button"
          role="option"
          aria-selected={index === selectedIndex}
          class="autocomplete-item"
          class:selected={index === selectedIndex}
          onclick={() => handleSuggestionClick(suggestion)}
        >
          <!-- Icon -->
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="currentColor"
            class="autocomplete-icon {suggestion.isRepository ? 'text-primary' : 'text-text-muted'}"
          >
            {#if suggestion.isRepository}
              <path d="M4.177 7.823A4.5 4.5 0 118 12.5a4.474 4.474 0 01-1.653-.316.75.75 0 11.557-1.392 2.999 2.999 0 001.096.208 3 3 0 10-2.108-5.134.75.75 0 01.236.662l.428 3.009a.75.75 0 01-1.255.592L2.847 7.677a.75.75 0 01.426-1.27A4.476 4.476 0 014.177 7.823zM8 1a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 018 1zm3.197 2.197a.75.75 0 01.092.992l-1 1.25a.75.75 0 01-1.17-.938l1-1.25a.75.75 0 01.992-.092.75.75 0 01.086.038zM5.75 8a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 015.75 8zm5.447 2.197a.75.75 0 01.092.992l-1 1.25a.75.75 0 11-1.17-.938l1-1.25a.75.75 0 01.992-.092.75.75 0 01.086.038z" />
            {:else if suggestion.type === 'directory'}
              <path d="M1.75 1h5.5c.966 0 1.75.784 1.75 1.75v1h4c.966 0 1.75.784 1.75 1.75v7.75A1.75 1.75 0 0113 15H3a1.75 1.75 0 01-1.75-1.75V2.75C1.25 1.784 1.784 1 1.75 1zM2.75 2.5v10.75c0 .138.112.25.25.25h10a.25.25 0 00.25-.25V5.5a.25.25 0 00-.25-.25H8.75v-2.5a.25.25 0 00-.25-.25h-5.5a.25.25 0 00-.25.25z" />
            {:else}
              <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0113.25 16h-9.5A1.75 1.75 0 012 14.25V1.75zm1.75-.25a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 00.25-.25V6h-2.75A1.75 1.75 0 019 4.25V1.5H3.75zm6.75.062V4.25c0 .138.112.25.25.25h2.688a.252.252 0 00-.011-.013l-2.914-2.914a.272.272 0 00-.013-.011z" />
            {/if}
          </svg>

          <!-- Name -->
          <span class="autocomplete-name">
            {suggestion.name}
          </span>

          <!-- Git branch indicator -->
          {#if suggestion.gitBranch}
            <span class="autocomplete-branch">
              [{suggestion.gitBranch}]
              {#if suggestion.isWorktree}
                <span class="autocomplete-worktree" title="Git worktree">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z"/>
                  </svg>
                </span>
              {/if}
            </span>
          {/if}

          <!-- Git status indicators -->
          {#if suggestion.gitAddedCount || suggestion.gitModifiedCount || suggestion.gitDeletedCount}
            <div class="autocomplete-status">
              {#if suggestion.gitAddedCount && suggestion.gitAddedCount > 0}
                <span class="status-added">
                  <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  {suggestion.gitAddedCount}
                </span>
              {/if}
              {#if suggestion.gitModifiedCount && suggestion.gitModifiedCount > 0}
                <span class="status-modified">
                  <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z" />
                  </svg>
                  {suggestion.gitModifiedCount}
                </span>
              {/if}
              {#if suggestion.gitDeletedCount && suggestion.gitDeletedCount > 0}
                <span class="status-deleted">
                  <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  {suggestion.gitDeletedCount}
                </span>
              {/if}
            </div>
          {/if}

          <!-- Spacer -->
          <div class="flex-1"></div>
        </button>
      {/each}

      {#if isLoading}
        <div class="autocomplete-loading">
          <div class="loading-spinner"></div>
          <span>Loading suggestions...</span>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .autocomplete-dropdown {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    overflow: hidden;
    max-height: 320px;
  }

  .autocomplete-list {
    max-height: 320px;
    overflow-y: auto;
  }

  .autocomplete-item {
    @apply w-full text-left px-3 py-2 hover:bg-surface-hover transition-colors duration-200 flex items-center gap-2 text-text text-xs sm:text-sm;
    border: none;
    background: none;
    cursor: pointer;
  }

  .autocomplete-item.selected {
    @apply bg-primary/20 border-l-2 border-primary;
  }

  .autocomplete-item:focus {
    @apply outline-none bg-primary/10;
  }

  .autocomplete-icon {
    @apply flex-shrink-0;
  }

  .autocomplete-name {
    @apply font-medium min-w-0 truncate;
  }

  .autocomplete-branch {
    @apply text-primary text-xs flex items-center gap-1;
  }

  .autocomplete-worktree {
    @apply text-purple-500 ml-0.5;
  }

  .autocomplete-status {
    @apply flex items-center gap-1.5 text-xs;
  }

  .status-added {
    @apply flex items-center gap-0.5 text-green-500;
  }

  .status-modified {
    @apply flex items-center gap-0.5 text-yellow-500;
  }

  .status-deleted {
    @apply flex items-center gap-0.5 text-red-500;
  }

  .autocomplete-loading {
    @apply px-3 py-2 text-text-muted text-xs flex items-center gap-2;
  }

  .loading-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid var(--border);
    border-top: 2px solid var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Dark mode adjustments */
  @media (prefers-color-scheme: dark) {
    .autocomplete-dropdown {
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
    }
  }
</style>