<!--
  Session Create Form Component

  Modal dialog for creating new terminal sessions. Provides command input,
  working directory selection, and options for spawning in native terminal.

  @fires session-created - When session is successfully created (detail: { sessionId: string, message?: string })
  @fires cancel - When form is cancelled
  @fires error - When creation fails (detail: string)

  @listens file-selected - From file browser when directory is selected
  @listens browser-cancel - From file browser when cancelled
-->
<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { DEFAULT_REPOSITORY_BASE_PATH } from '../../../client/shared/constants.js';
  import type { Session } from '../../../client/shared/types.js';
  import { TitleMode } from '../../../client/shared/types.js';
  import type { QuickStartCommand } from '../../../client/types/config.js';
  import type { AuthClient } from '../../../client/services/auth-client.js';
  import { type GitRepoInfo, GitService } from '../../../client/services/git-service.js';
  import { RepositoryService } from '../../../client/services/repository-service.js';
  import { ServerConfigService } from '../../../client/services/server-config-service.js';
  import { type SessionCreateData, SessionService } from '../../../client/services/session-service.js';
  import { parseCommand } from '../../../client/utils/command-utils.js';
  import { createLogger } from '../../../client/utils/logger.js';
  import {
    getSessionFormValue,
    loadSessionFormData,
    removeSessionFormValue,
    saveSessionFormData,
    setSessionFormValue,
  } from '../../../client/utils/storage-utils.js';
  import type { AutocompleteItem, Repository } from '../../../client/components/autocomplete-manager.js';
  import type { WorktreeInfo } from './GitBranchSelector.svelte';
  import {
    checkFollowMode,
    enableFollowMode,
    generateWorktreePath,
    loadBranches,
  } from './git-utils.js';
  import type { QuickStartItem } from './QuickStartSection.svelte';

  import DirectoryAutocomplete from './DirectoryAutocomplete.svelte';
  import GitBranchSelector from './GitBranchSelector.svelte';
  import QuickStartSection from './QuickStartSection.svelte';
  import FormOptionsSection from './FormOptionsSection.svelte';
  import RepositoryDropdown from './RepositoryDropdown.svelte';

  const logger = createLogger('session-create-form');
  const dispatch = createEventDispatcher<{
    'session-created': { sessionId: string; message?: string };
    cancel: void;
    error: string;
    'working-dir-change': string;
    success: string;
  }>();

  // Props
  interface Props {
    workingDir?: string;
    command?: string;
    sessionName?: string;
    disabled?: boolean;
    visible?: boolean;
    authClient?: AuthClient;
    spawnWindow?: boolean;
    titleMode?: TitleMode;
  }

  let {
    workingDir = $bindable(DEFAULT_REPOSITORY_BASE_PATH),
    command = $bindable('zsh'),
    sessionName = $bindable(''),
    disabled = false,
    visible = false,
    authClient,
    spawnWindow = $bindable(false),
    titleMode = $bindable(TitleMode.DYNAMIC),
  }: Props = $props();

  // State
  let isCreating = $state(false);
  let showFileBrowser = $state(false);
  let showRepositoryDropdown = $state(false);
  let repositories = $state<Repository[]>([]);
  let macAppConnected = $state(false);
  let showCompletions = $state(false);
  let completions = $state<AutocompleteItem[]>([]);
  let selectedCompletionIndex = $state(-1);
  let isLoadingCompletions = $state(false);
  let gitRepoInfo = $state<GitRepoInfo | null>(null);
  let availableBranches = $state<string[]>([]);

  // New properties for split branch/worktree selectors
  let currentBranch = $state('');
  let selectedBaseBranch = $state('');
  let selectedWorktree = $state<string | undefined>();
  let branchSwitchWarning = $state<string | undefined>();
  let availableWorktrees = $state<WorktreeInfo[]>([]);
  let isLoadingBranches = $state(false);
  let isLoadingWorktrees = $state(false);

  // Follow mode state
  let followMode = $state(false);
  let followBranch = $state<string | null>(null);
  let showFollowMode = $state(false);

  let quickStartCommands = $state<QuickStartItem[]>([
    { label: '✨ claude', command: 'claude' },
    { label: '✨ gemini', command: 'gemini' },
    { label: '✨ opencode', command: 'opencode' },
    { label: 'zsh', command: 'zsh' },
    { label: 'python3', command: 'python3' },
    { label: 'node', command: 'node' },
    { label: '▶️ pnpm run dev', command: 'pnpm run dev' },
  ]);

  // State properties for UI
  let selectedQuickStart = $state('');

  // State for discovering directories and checking Git
  let isDiscovering = $state(false);
  let isCheckingGit = $state(false);
  let isCheckingFollowMode = $state(false);

  // Services
  let completionsDebounceTimer: NodeJS.Timeout | undefined;
  let gitCheckDebounceTimer: NodeJS.Timeout | undefined;
  let autocompleteManager: any; // AutocompleteManager
  let repositoryService: RepositoryService | undefined;
  let sessionService: SessionService | undefined;
  let serverConfigService: ServerConfigService | undefined;
  let gitService: GitService | undefined;

  onMount(() => {
    // Initialize services - AutocompleteManager handles optional authClient
    autocompleteManager = new (await import('../../../client/components/autocomplete-manager.js')).AutocompleteManager(authClient);
    serverConfigService = new ServerConfigService(authClient);

    // Initialize other services only if authClient is available
    if (authClient) {
      repositoryService = new RepositoryService(authClient, serverConfigService);
      sessionService = new SessionService(authClient);
      gitService = new GitService(authClient);
    }
    // Load from localStorage when component is first created
    loadFromLocalStorage();
    // Check server status
    checkServerStatus();
    // Load server configuration including quick start commands
    loadServerConfig();
  });

  // Handle visibility changes
  $effect(() => {
    if (visible) {
      // Reset to defaults first to ensure clean state
      workingDir = DEFAULT_REPOSITORY_BASE_PATH;
      command = 'zsh';
      sessionName = '';
      spawnWindow = false;
      titleMode = TitleMode.DYNAMIC;
      branchSwitchWarning = undefined;

      // Then load from localStorage which may override the defaults
      loadFromLocalStorage();

      // Re-check server status when form becomes visible
      checkServerStatus();

      // Discover repositories
      discoverRepositories();
    }
  });

  // Global keyboard handler
  $effect(() => {
    if (!visible) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();

        // If autocomplete is visible, close it first
        if (showCompletions) {
          showCompletions = false;
          selectedCompletionIndex = -1;
        } else {
          // Otherwise close the dialog
          handleCancel();
        }
      } else if (e.key === 'Enter') {
        // Don't interfere with Enter in textarea elements
        if (e.target instanceof HTMLTextAreaElement) return;

        // Don't submit if autocomplete is active and an item is selected
        if (showCompletions && selectedCompletionIndex >= 0) return;

        // Check if form is valid (same conditions as Create button)
        const canCreate =
          !disabled && !isCreating && workingDir?.trim() && command?.trim();

        if (canCreate) {
          e.preventDefault();
          e.stopPropagation();
          handleCreate();
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  });

  // Cleanup timers
  $effect(() => {
    return () => {
      if (completionsDebounceTimer) {
        clearTimeout(completionsDebounceTimer);
      }
      if (gitCheckDebounceTimer) {
        clearTimeout(gitCheckDebounceTimer);
      }
    };
  });

  async function loadFromLocalStorage() {
    const formData = loadSessionFormData();

    // Get repository base path from server config to use as default working dir
    let appRepoBasePath = DEFAULT_REPOSITORY_BASE_PATH;
    if (serverConfigService) {
      try {
        appRepoBasePath = await serverConfigService.getRepositoryBasePath();
      } catch (error) {
        logger.error('Failed to get repository base path from server:', error);
        appRepoBasePath = DEFAULT_REPOSITORY_BASE_PATH;
      }
    }

    // Always set values, using saved values or defaults
    workingDir = formData.workingDir || appRepoBasePath || DEFAULT_REPOSITORY_BASE_PATH;
    command = formData.command || 'zsh';

    // For spawn window, use saved value or default to false
    spawnWindow = formData.spawnWindow ?? false;

    // For title mode, use saved value or default to DYNAMIC
    titleMode = formData.titleMode || TitleMode.DYNAMIC;
  }

  function saveToLocalStorage() {
    const workingDirTrimmed = workingDir?.trim() || '';
    const commandTrimmed = command?.trim() || '';

    saveSessionFormData({
      workingDir: workingDirTrimmed,
      command: commandTrimmed,
      spawnWindow,
      titleMode,
    });
  }

  async function loadServerConfig() {
    if (!serverConfigService) {
      return;
    }

    try {
      const quickStartCommandsFromServer = await serverConfigService.getQuickStartCommands();
      if (quickStartCommandsFromServer && quickStartCommandsFromServer.length > 0) {
        // Map server config to our format
        quickStartCommands = quickStartCommandsFromServer.map((cmd: QuickStartCommand) => ({
          label: cmd.name || cmd.command,
          command: cmd.command,
        }));
        logger.debug('Loaded quick start commands from server:', quickStartCommands);
      }
    } catch (error) {
      logger.error('Failed to load server config:', error);
      // Keep default quick start commands on error
    }
  }

  async function handleQuickStartChanged(e: CustomEvent<QuickStartCommand[]>) {
    const commands = e.detail;

    if (!serverConfigService) {
      logger.error('Server config service not initialized');
      return;
    }

    try {
      await serverConfigService.updateQuickStartCommands(commands);

      // Update local state
      quickStartCommands = commands.map((cmd: QuickStartCommand) => ({
        label: cmd.name || cmd.command,
        command: cmd.command,
      }));
      logger.debug('Updated quick start commands:', quickStartCommands);
    } catch (error) {
      logger.error('Failed to save quick start commands:', error);
    }
  }

  async function checkServerStatus() {
    // Defensive check - authClient should always be provided
    if (!authClient) {
      logger.warn('checkServerStatus called without authClient');
      macAppConnected = false;
      return;
    }

    try {
      const response = await fetch('/api/server/status', {
        headers: authClient.getAuthHeader(),
      });
      if (response.ok) {
        const status = await response.json();
        macAppConnected = status.macAppConnected || false;
        logger.debug('server status:', status);
      }
    } catch (error) {
      logger.warn('failed to check server status:', error);
      // Default to not connected if we can't check
      macAppConnected = false;
    }
  }

  function handleWorkingDirChange(e: Event) {
    const input = e.target as HTMLInputElement;
    workingDir = input.value;
    dispatch('working-dir-change', workingDir);

    // Hide repository dropdown when typing
    showRepositoryDropdown = false;

    // Trigger autocomplete with debounce
    if (completionsDebounceTimer) {
      clearTimeout(completionsDebounceTimer);
    }

    completionsDebounceTimer = setTimeout(() => {
      fetchCompletions();
    }, 300);

    // Check if directory is a Git repository with debounce
    if (gitCheckDebounceTimer) {
      clearTimeout(gitCheckDebounceTimer);
    }

    gitCheckDebounceTimer = setTimeout(() => {
      checkGitRepository();
    }, 500);
  }

  function handleCommandChange(e: Event) {
    const input = e.target as HTMLInputElement;
    command = input.value;

    // Auto-select dynamic mode for Claude
    if (command.toLowerCase().includes('claude')) {
      titleMode = TitleMode.DYNAMIC;
    }
  }

  function handleSessionNameChange(e: Event) {
    const input = e.target as HTMLInputElement;
    sessionName = input.value;
  }

  function handleSpawnWindowChanged(e: CustomEvent) {
    spawnWindow = e.detail.enabled;
  }

  function handleTitleModeChanged(e: CustomEvent) {
    titleMode = e.detail.mode as TitleMode;
  }

  function handleFollowModeChanged(e: CustomEvent) {
    showFollowMode = e.detail.enabled;
  }

  function handleBrowse() {
    logger.debug('handleBrowse called, setting showFileBrowser to true');
    showFileBrowser = true;
  }

  function handleDirectorySelected(e: CustomEvent) {
    // Keep absolute path - don't format for display when storing the working directory
    // The server needs the absolute path to create the session
    workingDir = e.detail;
    showFileBrowser = false;
    // Check Git repository after directory selection
    checkGitRepository();
  }

  function handleBrowserCancel() {
    showFileBrowser = false;
  }

  async function handleCreate() {
    if (!workingDir?.trim() || !command?.trim()) {
      dispatch('error', 'Please fill in both working directory and command');
      return;
    }

    isCreating = true;

    // Determine if we're actually spawning a terminal window
    const effectiveSpawnTerminal = spawnWindow && macAppConnected;

    // Determine the working directory and branch
    let effectiveWorkingDir = workingDir?.trim() || '';
    let effectiveBranch = '';

    if (selectedWorktree && availableWorktrees.length > 0) {
      // Using a worktree - use its path and branch
      const selectedWorktreeInfo = availableWorktrees.find(
        (wt) => wt.branch === selectedWorktree
      );
      if (selectedWorktreeInfo?.path) {
        // Use the absolute path directly - don't format for display
        // The server needs the absolute path, not the display format
        effectiveWorkingDir = selectedWorktreeInfo.path;
        effectiveBranch = selectedWorktree;
        logger.log(
          `Using worktree path: ${effectiveWorkingDir} for branch: ${selectedWorktree}`
        );
      }
    } else if (
      gitRepoInfo?.isGitRepo &&
      selectedBaseBranch &&
      selectedBaseBranch !== currentBranch
    ) {
      // Not using worktree but selected a different branch - attempt to switch
      logger.log(`Attempting to switch from ${currentBranch} to ${selectedBaseBranch}`);

      // Direct branch switching without worktrees is no longer supported
      logger.log(
        `Selected branch ${selectedBaseBranch} differs from current branch ${currentBranch}, but direct branch switching is not supported. Using current branch.`
      );
      effectiveBranch = currentBranch;

      branchSwitchWarning = `Cannot switch to ${selectedBaseBranch} without a worktree. Create a worktree or use the current branch ${currentBranch}.`;
    } else {
      // Using current branch
      effectiveBranch = selectedBaseBranch || currentBranch;
    }

    const sessionData: SessionCreateData = {
      command: parseCommand(command?.trim() || ''),
      workingDir: effectiveWorkingDir,
      spawn_terminal: effectiveSpawnTerminal,
      titleMode,
    };

    // Add Git information if available
    if (gitRepoInfo?.isGitRepo && gitRepoInfo.repoPath && effectiveBranch) {
      sessionData.gitRepoPath = gitRepoInfo.repoPath;
      sessionData.gitBranch = effectiveBranch;
    }

    // Only add dimensions for web sessions (not external terminal spawns)
    if (!effectiveSpawnTerminal) {
      // Use conservative defaults that work well across devices
      // The terminal will auto-resize to fit the actual container after creation
      sessionData.cols = 120;
      sessionData.rows = 30;
    }

    // Add session name if provided
    if (sessionName?.trim()) {
      sessionData.name = sessionName.trim();
    }

    // Handle follow mode - only enable when a worktree is selected
    if (
      showFollowMode &&
      selectedWorktree &&
      selectedWorktree !== 'none' &&
      gitRepoInfo?.repoPath &&
      effectiveBranch &&
      authClient
    ) {
      try {
        // Check if follow mode is already active for a different branch
        if (followMode && followBranch && followBranch !== effectiveBranch) {
          logger.log(
            `Follow mode is already active for branch: ${followBranch}, switching to: ${effectiveBranch}`
          );
        }

        logger.log(`Enabling follow mode for worktree branch: ${effectiveBranch}`);
        const success = await enableFollowMode(
          gitRepoInfo.repoPath,
          effectiveBranch,
          authClient
        );

        if (!success) {
          // Show error to user
          dispatch('error', 'Failed to enable follow mode. Session will be created without follow mode.');
        } else {
          logger.log('Follow mode enabled successfully for worktree');
          // Update local state
          followMode = true;
          followBranch = effectiveBranch;
        }
      } catch (error) {
        logger.error('Error enabling follow mode:', error);
        dispatch('error', 'Error enabling follow mode. Session will be created without follow mode.');
      }
    }

    try {
      // Check if sessionService is initialized
      if (!sessionService) {
        throw new Error('Session service not initialized');
      }
      const result = await sessionService.createSession(sessionData);

      // Save to localStorage before clearing the fields
      // In test environments, don't save spawn window to avoid cross-test contamination
      const isTestEnvironment =
        window.location.search.includes('test=true') ||
        navigator.userAgent.includes('HeadlessChrome');

      if (isTestEnvironment) {
        // Save everything except spawn window in tests
        const currentSpawnWindow = getSessionFormValue('SPAWN_WINDOW');
        saveToLocalStorage();
        // Restore the original spawn window value
        if (currentSpawnWindow !== null) {
          setSessionFormValue('SPAWN_WINDOW', currentSpawnWindow);
        } else {
          removeSessionFormValue('SPAWN_WINDOW');
        }
      } else {
        saveToLocalStorage();
      }

      command = ''; // Clear command on success
      sessionName = ''; // Clear session name on success
      dispatch('session-created', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create session';
      logger.error('Error creating session:', error);
      dispatch('error', errorMessage);
    } finally {
      isCreating = false;
    }
  }

  function handleCancel() {
    dispatch('cancel');
  }

  function handleBackdropClick(e: Event) {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  }

  function handleQuickStartSelected(e: CustomEvent) {
    const selectedCommand = e.detail.command;
    command = selectedCommand;
    selectedQuickStart = selectedCommand;

    // Auto-select dynamic mode for Claude
    if (selectedCommand.toLowerCase().includes('claude')) {
      titleMode = TitleMode.DYNAMIC;
    }
  }

  function handleBranchChanged(e: CustomEvent) {
    selectedBaseBranch = e.detail.branch;
    // Clear any previous warning
    branchSwitchWarning = undefined;
  }

  function handleWorktreeChanged(e: CustomEvent) {
    selectedWorktree = e.detail.worktree;
    // Clear any previous warning
    branchSwitchWarning = undefined;

    // Reset follow mode toggle when no worktree is selected
    if (!selectedWorktree || selectedWorktree === 'none') {
      showFollowMode = false;
    }
  }

  async function handleCreateWorktreeRequest(e: CustomEvent) {
    const { branchName, baseBranch, customPath } = e.detail;
    if (!gitRepoInfo?.repoPath || !gitService) {
      return;
    }

    try {
      // Use custom path if provided, otherwise generate default
      const worktreePath =
        customPath || generateWorktreePath(gitRepoInfo.repoPath, branchName);

      // Create the worktree
      await gitService.createWorktree(
        gitRepoInfo.repoPath,
        branchName,
        worktreePath,
        baseBranch
      );

      // Update working directory to the new worktree
      workingDir = worktreePath;

      // Update selected base branch to the new branch
      selectedBaseBranch = branchName;

      // Add new branch to available branches
      if (!availableBranches.includes(branchName)) {
        availableBranches = [...availableBranches, branchName];
      }

      // Reload worktrees
      await loadWorktrees(gitRepoInfo.repoPath, worktreePath);

      // Select the newly created worktree
      selectedWorktree = branchName;

      // Git branch selector will reset its own state after successful creation

      // Show success message
      dispatch('success', `Created worktree for branch '${branchName}'`);
    } catch (error) {
      logger.error('Failed to create worktree:', error);

      // Git branch selector will reset its own state on error

      // Determine specific error message
      let errorMessage = 'Failed to create worktree';
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          errorMessage = `Worktree path already exists. Try a different branch name.`;
        } else if (error.message.includes('already checked out')) {
          errorMessage = `Branch '${branchName}' is already checked out in another worktree`;
        } else if (error.message.includes('Permission denied')) {
          errorMessage = 'Permission denied. Check directory permissions.';
        } else {
          errorMessage = error.message;
        }
      }

      dispatch('error', errorMessage);
    }
  }

  function handleAutocompleteItemSelected(e: CustomEvent) {
    handleSelectCompletion(e.detail.suggestion);
  }

  function handleRepositorySelected(e: CustomEvent) {
    handleSelectRepository(e.detail.path);
  }

  async function discoverRepositories() {
    isDiscovering = true;
    try {
      // Only proceed if repositoryService is initialized
      if (repositoryService) {
        repositories = await repositoryService.discoverRepositories();
        // Update autocomplete manager with discovered repositories
        autocompleteManager.setRepositories(repositories);
      } else {
        logger.warn('Repository service not initialized yet');
        repositories = [];
      }
    } finally {
      isDiscovering = false;
    }
  }

  function handleToggleAutocomplete() {
    // If we have text input, toggle the autocomplete
    if (workingDir?.trim()) {
      if (showCompletions) {
        showCompletions = false;
        completions = [];
      } else {
        fetchCompletions();
      }
    } else {
      // If no text, show repository dropdown instead
      showRepositoryDropdown = !showRepositoryDropdown;
    }
  }

  function handleSelectRepository(repoPath: string) {
    // Keep absolute path - server needs it for session creation
    workingDir = repoPath;
    showRepositoryDropdown = false;
    // Check Git repository after selection
    checkGitRepository();
  }

  async function fetchCompletions() {
    const path = workingDir?.trim();
    if (!path || path === '') {
      completions = [];
      showCompletions = false;
      return;
    }

    isLoadingCompletions = true;

    try {
      // Use the autocomplete manager to fetch completions
      completions = await autocompleteManager.fetchCompletions(path);
      showCompletions = completions.length > 0;
      // Auto-select the first item when completions are shown
      selectedCompletionIndex = completions.length > 0 ? 0 : -1;
    } catch (error) {
      logger.error('Error fetching completions:', error);
      completions = [];
      showCompletions = false;
    } finally {
      isLoadingCompletions = false;
    }
  }

  function handleSelectCompletion(suggestion: string) {
    // Keep absolute path - server needs it for session creation
    workingDir = suggestion;
    showCompletions = false;
    completions = [];
    selectedCompletionIndex = -1;
    // Check Git repository after autocomplete selection
    checkGitRepository();
  }

  function handleWorkingDirKeydown(e: KeyboardEvent) {
    if (!showCompletions || completions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedCompletionIndex = Math.min(
        selectedCompletionIndex + 1,
        completions.length - 1
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedCompletionIndex = Math.max(selectedCompletionIndex - 1, -1);
    } else if (e.key === 'Tab' || e.key === 'Enter') {
      // Allow Enter/Tab to select the auto-selected first item or any selected item
      if (selectedCompletionIndex >= 0 && completions[selectedCompletionIndex]) {
        e.preventDefault();
        e.stopPropagation();
        handleSelectCompletion(completions[selectedCompletionIndex].suggestion);
      }
    }
  }

  function handleWorkingDirBlur() {
    // Hide completions after a delay to allow clicking on them
    setTimeout(() => {
      showCompletions = false;
      selectedCompletionIndex = -1;
    }, 200);
  }

  async function checkGitRepository() {
    const path = workingDir?.trim();
    logger.log(`🔍 Checking Git repository for path: ${path}`);

    if (!path || !gitService) {
      logger.debug('No path or gitService, clearing Git info');
      gitRepoInfo = null;
      availableBranches = [];
      selectedBaseBranch = '';
      followMode = false;
      followBranch = null;
      return;
    }

    isCheckingGit = true;
    try {
      const repoInfo = await gitService.checkGitRepo(path);
      logger.log(`✅ Git check result:`, repoInfo);

      if (repoInfo.isGitRepo && repoInfo.repoPath) {
        logger.log(`🎉 Git repository detected at: ${repoInfo.repoPath}`);
        gitRepoInfo = repoInfo;
        // Trigger re-render after updating gitRepoInfo

        // Load branches, worktrees, and follow mode status in parallel
        await Promise.all([
          loadBranches(repoInfo.repoPath),
          loadWorktrees(repoInfo.repoPath, path),
          checkFollowMode(repoInfo.repoPath),
        ]);
      } else {
        logger.log(`❌ Not a Git repository: ${path}`, repoInfo);
        gitRepoInfo = null;
        availableBranches = [];
        selectedBaseBranch = '';
        currentBranch = '';
        selectedBaseBranch = '';
        availableWorktrees = [];
        selectedWorktree = undefined;
        followMode = false;
        followBranch = null;
        // Trigger re-render to clear Git UI
      }
    } catch (error) {
      logger.error('❌ Error checking Git repository:', error);
      gitRepoInfo = null;
      availableBranches = [];
      selectedBaseBranch = '';
      currentBranch = '';
      selectedBaseBranch = '';
      availableWorktrees = [];
      selectedWorktree = undefined;
      followMode = false;
      followBranch = null;
    } finally {
      isCheckingGit = false;
    }
  }

  async function loadBranches(repoPath: string): Promise<void> {
    if (!authClient) {
      return;
    }

    isLoadingBranches = true;
    try {
      const { branches, currentBranch: current } = await loadBranches(repoPath, authClient);
      availableBranches = branches;

      if (current) {
        currentBranch = current;
        if (!selectedBaseBranch) {
          selectedBaseBranch = currentBranch;
        }
      }
    } finally {
      isLoadingBranches = false;
    }
  }

  async function loadWorktrees(repoPath: string, currentPath: string): Promise<void> {
    if (!gitService) {
      return;
    }

    isLoadingWorktrees = true;
    try {
      const response = await gitService.listWorktrees(repoPath);
      availableWorktrees = response.worktrees.map((wt) => ({
        // Strip refs/heads/ prefix for display
        branch: wt.branch.replace(/^refs\/heads\//, ''),
        path: wt.path,
        isMainWorktree: wt.isMainWorktree,
        isCurrentWorktree: wt.path === currentPath,
      }));

      // Update current branch based on worktree info
      const currentWorktree = response.worktrees.find(
        (wt) => wt.isCurrentWorktree || wt.path === currentPath
      );
      if (currentWorktree) {
        // Strip refs/heads/ prefix from branch name
        currentBranch = currentWorktree.branch.replace(/^refs\/heads\//, '');
        if (!selectedBaseBranch) {
          selectedBaseBranch = currentBranch;
        }

        // Pre-select the current worktree if we're already in one (not the main worktree)
        if (!currentWorktree.isMainWorktree && !selectedWorktree) {
          selectedWorktree = currentWorktree.branch.replace(/^refs\/heads\//, '');
        }
      }
    } catch (error) {
      logger.error('Failed to load worktrees:', error);
      availableWorktrees = [];
    } finally {
      isLoadingWorktrees = false;
    }
  }

  function renderGitBranchIndicator() {
    if (
      !gitRepoInfo?.isGitRepo ||
      !currentBranch ||
      document.activeElement?.getAttribute('data-testid') === 'working-dir-input'
    ) {
      return '';
    }

    return `
      <span class="absolute inset-y-0 right-2 flex items-center pointer-events-none">
        <span class="text-[10px] sm:text-xs text-primary font-medium flex items-center gap-1">[${currentBranch}]
          ${gitRepoInfo.hasChanges ? '<span class="text-yellow-500" title="Modified">●</span>' : ''}
          ${
            gitRepoInfo.isWorktree
              ? '<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" class="text-purple-400" title="Git worktree"><path d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z"/></svg>'
              : ''
          }
        </span>
      </div>
    `;
  }

  function handleWorkingDirFocus() {
    // Force re-render to hide the branch indicator
  }

  async function checkFollowMode(repoPath: string): Promise<void> {
    if (!authClient) {
      return;
    }

    isCheckingFollowMode = true;
    try {
      const { followMode: mode, followBranch: branch } = await checkFollowMode(
        repoPath,
        authClient
      );
      followMode = mode;
      followBranch = branch;
      logger.log('Follow mode status:', {
        followMode,
        followBranch,
      });
    } finally {
      isCheckingFollowMode = false;
    }
  }
</script>

{#if visible}
  <div
    class="modal-backdrop flex items-center justify-center py-4 sm:py-6 lg:py-8"
    onclick={handleBackdropClick}
    role="dialog"
    aria-modal="true"
  >
    <div
      class="modal-content font-mono text-sm w-full max-w-[calc(100vw-1rem)] sm:max-w-md lg:max-w-[576px] mx-2 sm:mx-4 overflow-hidden"
      onclick={(e) => e.stopPropagation()}
      data-testid="session-create-modal"
    >
      <div class="p-3 sm:p-4 mb-1 sm:mb-2 border-b border-border/50 relative bg-gradient-to-r from-bg-secondary to-bg-tertiary flex-shrink-0 rounded-t-xl flex items-center justify-between">
        <h2 id="modal-title" class="text-primary text-base sm:text-lg lg:text-xl font-bold">New Session</h2>
        <button
          class="text-text-muted hover:text-text transition-all duration-200 p-1.5 sm:p-2 hover:bg-bg-elevated/30 rounded-lg"
          onclick={handleCancel}
          title="Close (Esc)"
          aria-label="Close modal"
        >
          <svg
            class="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div class="p-3 sm:p-4 overflow-y-auto flex-grow max-h-[calc(100vh-8rem)] sm:max-h-[calc(100vh-6rem)] lg:max-h-[calc(100vh-4rem)]">
        <!-- Branch Switch Warning -->
        {#if branchSwitchWarning}
          <div class="mb-2 sm:mb-3 p-2 sm:p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div class="flex items-start gap-2">
              <svg class="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p class="text-[10px] sm:text-xs text-yellow-200">
                {branchSwitchWarning}
              </p>
            </div>
          </div>
        {/if}

        <!-- Session Name -->
        <div class="mb-2 sm:mb-3">
          <label class="form-label text-text-muted text-[10px] sm:text-xs lg:text-sm">Session Name (Optional):</label>
          <input
            type="text"
            class="input-field py-1.5 sm:py-2 lg:py-3 text-xs sm:text-sm"
            bind:value={sessionName}
            oninput={handleSessionNameChange}
            placeholder="My Session"
            disabled={disabled || isCreating}
            data-testid="session-name-input"
          />
        </div>

        <!-- Command -->
        <div class="mb-2 sm:mb-3">
          <label class="form-label text-text-muted text-[10px] sm:text-xs lg:text-sm">Command:</label>
          <input
            type="text"
            class="input-field py-1.5 sm:py-2 lg:py-3 text-xs sm:text-sm"
            bind:value={command}
            oninput={handleCommandChange}
            placeholder="zsh"
            disabled={disabled || isCreating}
            data-testid="command-input"
          />
        </div>

        <!-- Working Directory -->
        <div class="mb-3 sm:mb-4">
          <label class="form-label text-text-muted text-[10px] sm:text-xs lg:text-sm">Working Directory:</label>
          <div class="relative">
            <div class="flex gap-1.5 sm:gap-2">
              <div class="relative flex-1">
                <input
                  type="text"
                  class="input-field py-1.5 sm:py-2 lg:py-3 text-xs sm:text-sm w-full pr-24"
                  bind:value={workingDir}
                  oninput={handleWorkingDirChange}
                  onkeydown={handleWorkingDirKeydown}
                  onblur={handleWorkingDirBlur}
                  onfocus={handleWorkingDirFocus}
                  placeholder="~/"
                  disabled={disabled || isCreating}
                  data-testid="working-dir-input"
                  autocomplete="off"
                />
                {@html renderGitBranchIndicator()}
              </div>
              <button
                id="session-browse-button"
                class="bg-bg-tertiary border border-border/50 rounded-lg p-1.5 sm:p-2 lg:p-3 font-mono text-text-muted transition-all duration-200 hover:text-primary hover:bg-surface-hover hover:border-primary/50 hover:shadow-sm flex-shrink-0"
                onclick={handleBrowse}
                disabled={disabled || isCreating}
                title="Browse directories"
                type="button"
              >
                <svg width="12" height="12" class="sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4" viewBox="0 0 16 16" fill="currentColor">
                  <path
                    d="M1.75 1h5.5c.966 0 1.75.784 1.75 1.75v1h4c.966 0 1.75.784 1.75 1.75v7.75A1.75 1.75 0 0113 15H3a1.75 1.75 0 01-1.75-1.75V2.75C1.25 1.784 1.784 1 1.75 1zM2.75 2.5v10.75c0 .138.112.25.25.25h10a.25.25 0 00.25-.25V5.5a.25.25 0 00-.25-.25H8.75v-2.5a.25.25 0 00-.25-.25h-5.5a.25.25 0 00-.25.25z"
                  />
                </svg>
              </button>
              <button
                id="session-autocomplete-button"
                class="bg-bg-tertiary border border-border/50 rounded-lg p-1.5 sm:p-2 lg:p-3 font-mono text-text-muted transition-all duration-200 hover:text-primary hover:bg-surface-hover hover:border-primary/50 hover:shadow-sm flex-shrink-0 {showRepositoryDropdown || showCompletions ? 'text-primary border-primary/50' : ''}"
                onclick={handleToggleAutocomplete}
                disabled={disabled || isCreating}
                title="Choose from repositories or recent directories"
                type="button"
              >
                <svg
                  width="12"
                  height="12"
                  class="sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 transition-transform duration-200"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  style="transform: {showRepositoryDropdown || showCompletions ? 'rotate(90deg)' : 'rotate(0deg)'}"
                >
                  <path
                    d="M5.22 1.22a.75.75 0 011.06 0l6.25 6.25a.75.75 0 010 1.06l-6.25 6.25a.75.75 0 01-1.06-1.06L10.94 8 5.22 2.28a.75.75 0 010-1.06z"
                  />
                </path>
              </button>
            </div>
            <DirectoryAutocomplete
              visible={showCompletions}
              items={completions}
              selectedIndex={selectedCompletionIndex}
              isLoading={isLoadingCompletions}
              on:item-selected={handleAutocompleteItemSelected}
            />
            <RepositoryDropdown
              visible={showRepositoryDropdown}
              repositories={repositories}
              on:repository-selected={handleRepositorySelected}
            />
          </div>
        </div>

        <!-- Git Branch/Worktree Selection (shown when Git repository detected) -->
        <GitBranchSelector
          gitRepoInfo={gitRepoInfo}
          disabled={disabled}
          isCreating={isCreating}
          currentBranch={currentBranch}
          selectedBaseBranch={selectedBaseBranch}
          selectedWorktree={selectedWorktree}
          availableBranches={availableBranches}
          availableWorktrees={availableWorktrees}
          isLoadingBranches={isLoadingBranches}
          isLoadingWorktrees={isLoadingWorktrees}
          followMode={followMode}
          followBranch={followBranch}
          showFollowMode={showFollowMode}
          branchSwitchWarning={branchSwitchWarning}
          on:branch-changed={handleBranchChanged}
          on:worktree-changed={handleWorktreeChanged}
          on:create-worktree={handleCreateWorktreeRequest}
        />

        <!-- Quick Start Section -->
        <QuickStartSection
          commands={quickStartCommands}
          selectedCommand={command}
          disabled={disabled}
          isCreating={isCreating}
          on:quick-start-selected={handleQuickStartSelected}
          on:quick-start-changed={handleQuickStartChanged}
        />

        <!-- Options Section (collapsible) -->
        <FormOptionsSection
          macAppConnected={macAppConnected}
          spawnWindow={spawnWindow}
          titleMode={titleMode}
          gitRepoInfo={gitRepoInfo}
          followMode={followMode}
          followBranch={followBranch}
          showFollowMode={showFollowMode}
          selectedWorktree={selectedWorktree}
          disabled={disabled}
          isCreating={isCreating}
          on:spawn-window-changed={handleSpawnWindowChanged}
          on:title-mode-changed={handleTitleModeChanged}
          on:follow-mode-changed={handleFollowModeChanged}
        />

        <div class="flex gap-1.5 sm:gap-2 mt-2 sm:mt-3">
          <button
            id="session-cancel-button"
            class="flex-1 bg-bg-elevated border border-border/50 text-text px-2 py-1 sm:px-3 sm:py-1.5 lg:px-4 lg:py-2 xl:px-6 xl:py-3 rounded-lg font-mono text-[10px] sm:text-xs lg:text-sm transition-all duration-200 hover:bg-hover hover:border-border"
            onclick={handleCancel}
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            id="session-create-button"
            class="flex-1 bg-primary text-text-bright px-2 py-1 sm:px-3 sm:py-1.5 lg:px-4 lg:py-2 xl:px-6 xl:py-3 rounded-lg font-mono text-[10px] sm:text-xs lg:text-sm font-medium transition-all duration-200 hover:bg-primary-hover hover:shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
            onclick={handleCreate}
            disabled={disabled || isCreating || !workingDir?.trim() || !command?.trim()}
            data-testid="create-session-submit"
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- File Browser -->
  {#if showFileBrowser}
    <file-browser
      visible={showFileBrowser}
      mode="select"
      session={{ workingDir }}
      on:directory-selected={handleDirectorySelected}
      on:browser-cancel={handleBrowserCancel}
    />
  {/if}
{/if}