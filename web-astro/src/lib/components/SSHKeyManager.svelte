<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { onMount } from 'svelte';
  import ModalWrapper from './ModalWrapper.svelte';
  import { authToken } from '../stores/auth';
  import type { SSHKey } from '../types';

  // Props
  interface Props {
    visible?: boolean;
    sessionId?: string;
  }

  let { visible = $bindable(false), sessionId }: Props = $props();

  // State
  let keys = $state<SSHKey[]>([]);
  let loading = $state(false);
  let error = $state('');
  let success = $state('');
  let showAddForm = $state(false);
  let newKeyName = $state('');
  let newKeyPassword = $state('');
  let importKeyName = $state('');
  let importKeyContent = $state('');
  let showInstructions = $state(false);
  let instructionsKeyId = $state('');
  let searchQuery = $state('');
  let sortBy = $state<'name' | 'date' | 'type'>('name');
  let sortOrder = $state<'asc' | 'desc'>('asc');
  let selectedKeyType = $state<'rsa' | 'ed25519' | 'ecdsa'>('ed25519');
  let keySize = $state(2048);
  let keyComment = $state('');

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    'key-generated': { keyId: string; keyName: string };
    'key-imported': { keyId: string; keyName: string };
    'key-deleted': { keyId: string; keyName: string };
    'error': { message: string };
  }>();

  // Derived state
  let filteredKeys = $derived(() => {
    let filtered = keys;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(key =>
        key.name.toLowerCase().includes(query) ||
        key.comment.toLowerCase().includes(query) ||
        key.fingerprint.toLowerCase().includes(query)
      );
    }

    // Sort keys
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = new Date(a.created).getTime() - new Date(b.created).getTime();
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  });

  // Effects
  $effect(() => {
    if (visible) {
      refreshKeys();
    }
  });

  // Methods
  async function refreshKeys() {
    try {
      loading = true;
      error = '';

      const token = $authToken;
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/ssh/keys', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch SSH keys: ${response.statusText}`);
      }

      const data = await response.json();
      keys = data.keys || [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load SSH keys';
      dispatch('error', { message: error });
    } finally {
      loading = false;
    }
  }

  async function handleGenerateKey() {
    if (!newKeyName.trim()) {
      error = 'Please enter a key name';
      return;
    }

    loading = true;
    error = '';

    try {
      const token = $authToken;
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/ssh/keys/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newKeyName,
          type: selectedKeyType,
          size: keySize,
          passphrase: newKeyPassword || undefined,
          comment: keyComment || undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to generate key: ${response.statusText}`);
      }

      const result = await response.json();

      success = `SSH key "${newKeyName}" generated successfully.`;
      showInstructions = true;
      instructionsKeyId = result.keyId;
      showAddForm = false;

      // Reset form
      newKeyName = '';
      newKeyPassword = '';
      keyComment = '';

      await refreshKeys();

      dispatch('key-generated', { keyId: result.keyId, keyName: newKeyName });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to generate key';
      dispatch('error', { message: error });
    } finally {
      loading = false;
    }
  }

  async function handleImportKey() {
    if (!importKeyName.trim() || !importKeyContent.trim()) {
      error = 'Please enter both key name and private key content';
      return;
    }

    loading = true;
    error = '';

    try {
      const token = $authToken;
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/ssh/keys/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: importKeyName,
          privateKey: importKeyContent
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to import key: ${response.statusText}`);
      }

      const result = await response.json();

      success = `SSH key "${importKeyName}" imported successfully`;
      importKeyName = '';
      importKeyContent = '';
      showAddForm = false;

      await refreshKeys();

      dispatch('key-imported', { keyId: result.keyId, keyName: importKeyName });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to import key';
      dispatch('error', { message: error });
    } finally {
      loading = false;
    }
  }

  async function handleDeleteKey(keyId: string, keyName: string) {
    if (!confirm(`Are you sure you want to remove the SSH key "${keyName}"?`)) {
      return;
    }

    try {
      const token = $authToken;
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/ssh/keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete key: ${response.statusText}`);
      }

      success = `SSH key "${keyName}" removed successfully`;
      await refreshKeys();

      dispatch('key-deleted', { keyId, keyName });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to delete key';
      dispatch('error', { message: error });
    }
  }

  async function handleDownloadPublicKey(keyId: string, keyName: string) {
    try {
      const token = $authToken;
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/ssh/keys/${keyId}/public`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get public key: ${response.statusText}`);
      }

      const publicKey = await response.text();

      const blob = new Blob([publicKey], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${keyName.replace(/\s+/g, '_')}_public.pub`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to download public key';
      dispatch('error', { message: error });
    }
  }

  async function handleCopyPublicKey(keyId: string) {
    try {
      const token = $authToken;
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/ssh/keys/${keyId}/public`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get public key: ${response.statusText}`);
      }

      const publicKey = await response.text();
      await navigator.clipboard.writeText(publicKey);
      success = 'Public key copied to clipboard!';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to copy public key';
      dispatch('error', { message: error });
    }
  }

  async function handleCopyFingerprint(key: SSHKey) {
    try {
      await navigator.clipboard.writeText(key.fingerprint);
      success = 'Fingerprint copied to clipboard!';
    } catch (err) {
      error = 'Failed to copy fingerprint';
      dispatch('error', { message: error });
    }
  }

  async function handleTestKey(keyId: string, keyName: string) {
    try {
      const token = $authToken;
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/ssh/keys/${keyId}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Key test failed');
      }

      success = `SSH key "${keyName}" test successful!`;
    } catch (err) {
      error = `SSH key "${keyName}" test failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      dispatch('error', { message: error });
    }
  }

  function handleClose() {
    visible = false;
    showAddForm = false;
    showInstructions = false;
    error = '';
    success = '';
  }

  function toggleSort(field: 'name' | 'date' | 'type') {
    if (sortBy === field) {
      sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = field;
      sortOrder = 'asc';
    }
  }

  function getKeyTypeDisplay(type: string, size?: number): string {
    switch (type) {
      case 'rsa':
        return `RSA ${size || 2048}`;
      case 'ed25519':
        return 'Ed25519';
      case 'ecdsa':
        return 'ECDSA';
      default:
        return type.toUpperCase();
    }
  }

  function truncatePublicKey(publicKey: string): string {
    if (publicKey.length <= 60) return publicKey;
    return publicKey.substring(0, 57) + '...';
  }

  // Keyboard shortcuts
  function handleKeydown(event: KeyboardEvent) {
    if (!visible) return;

    if (event.key === 'Escape') {
      handleClose();
    } else if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case '/':
          event.preventDefault();
          // Focus search input
          const searchInput = document.querySelector('input[placeholder*="search"]') as HTMLInputElement;
          searchInput?.focus();
          break;
        case 'n':
          event.preventDefault();
          showAddForm = !showAddForm;
          break;
      }
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
  });
</script>

<ModalWrapper
  bind:visible
  modalClass="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1000]"
  contentClass="bg-bg-secondary border border-border rounded-lg p-6 w-full max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl z-[1001]"
  ariaLabel="SSH Key Manager"
  closeOnBackdrop={true}
  closeOnEscape={true}
  on:close={handleClose}
>
  <div class="relative mb-8">
    <h2 class="text-2xl font-mono text-primary text-center">🔑 SSH Key Manager</h2>
    <button
      onclick={handleClose}
      class="absolute top-0 right-0 w-8 h-8 flex items-center justify-center text-text-muted hover:text-primary hover:bg-surface rounded transition-colors"
      title="Close (Esc)"
    >
      ✕
    </button>
  </div>

  <!-- Error/Success Messages -->
  {#if error}
    <div class="bg-status-error/10 text-status-error border border-status-error/30 px-4 py-3 rounded-lg mb-4 font-mono text-sm flex items-start gap-2">
      <span class="text-lg">⚠️</span>
      <div class="flex-1">
        <p class="font-semibold">Error</p>
        <p>{error}</p>
      </div>
      <button
        onclick={() => error = ''}
        class="text-status-error hover:text-status-error/80"
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  {/if}

  {#if success}
    <div class="bg-status-success/10 text-status-success border border-status-success/30 px-4 py-3 rounded-lg mb-4 font-mono text-sm flex items-start gap-2">
      <span class="text-lg">✅</span>
      <div class="flex-1">
        <p class="font-semibold">Success</p>
        <p>{success}</p>
      </div>
      <button
        onclick={() => success = ''}
        class="text-status-success hover:text-status-success/80"
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  {/if}

  <!-- Search and Actions Bar -->
  <div class="flex flex-col sm:flex-row gap-4 mb-6 pb-3 border-b border-border">
    <div class="flex-1">
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search keys by name, comment, or fingerprint... (Ctrl+/)"
        class="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary font-mono text-sm"
      />
    </div>
    <div class="flex gap-2">
      <button
        onclick={() => showAddForm = !showAddForm}
        disabled={loading}
        class="btn-primary px-4 py-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        title={showAddForm ? 'Cancel (Ctrl+N)' : 'Add Key (Ctrl+N)'}
      >
        {showAddForm ? '✕ Cancel' : '+ Add Key'}
      </button>
      <button
        onclick={refreshKeys}
        disabled={loading}
        class="btn-secondary px-4 py-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        title="Refresh Keys"
      >
        🔄 Refresh
      </button>
    </div>
  </div>

  <!-- Add Key Form -->
  {#if showAddForm}
    <div class="space-y-6 mb-8">
      <!-- Generate New Key Section -->
      <div class="bg-surface border border-border rounded-lg p-6">
        <h4 class="text-primary font-mono text-lg mb-6 flex items-center gap-2 font-semibold">
          🔑 Generate New SSH Key
        </h4>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-text font-medium mb-2 font-mono text-sm">
              Key Name <span class="text-status-error">*</span>
            </label>
            <input
              type="text"
              bind:value={newKeyName}
              placeholder="Enter name for new key"
              disabled={loading}
              class="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary font-mono text-sm disabled:opacity-50"
            />
          </div>
          <div>
            <label class="block text-text font-medium mb-2 font-mono text-sm">
              Key Type
            </label>
            <select
              bind:value={selectedKeyType}
              disabled={loading}
              class="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary font-mono text-sm disabled:opacity-50"
            >
              <option value="ed25519">Ed25519 (recommended)</option>
              <option value="rsa">RSA</option>
              <option value="ecdsa">ECDSA</option>
            </select>
          </div>
        </div>

        {#if selectedKeyType === 'rsa'}
          <div class="mb-4">
            <label class="block text-text font-medium mb-2 font-mono text-sm">
              Key Size
            </label>
            <select
              bind:value={keySize}
              disabled={loading}
              class="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary font-mono text-sm disabled:opacity-50"
            >
              <option value={2048}>2048 bits</option>
              <option value={4096}>4096 bits (recommended)</option>
            </select>
          </div>
        {/if}

        <div class="mb-4">
          <label class="block text-text font-medium mb-2 font-mono text-sm">
            Comment (Optional)
          </label>
          <input
            type="text"
            bind:value={keyComment}
            placeholder="user@hostname or description"
            disabled={loading}
            class="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary font-mono text-sm disabled:opacity-50"
          />
        </div>

        <div class="mb-4">
          <label class="block text-text font-medium mb-2 font-mono text-sm">
            Passphrase (Optional)
          </label>
          <input
            type="password"
            bind:value={newKeyPassword}
            placeholder="Enter password to encrypt private key (optional)"
            disabled={loading}
            class="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary font-mono text-sm disabled:opacity-50"
          />
          <p class="text-text-muted text-xs mt-1">
            💡 Leave empty for unencrypted key. Password is required when using the key for signing.
          </p>
        </div>

        <button
          onclick={handleGenerateKey}
          disabled={loading || !newKeyName.trim()}
          class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Generating...' : 'Generate New Key'}
        </button>
      </div>

      <!-- Import Existing Key Section -->
      <div class="bg-surface border border-border rounded-lg p-6">
        <h4 class="text-primary font-mono text-lg mb-6 flex items-center gap-2 font-semibold">
          📁 Import Existing SSH Key
        </h4>

        <div class="mb-4">
          <label class="block text-text font-medium mb-2 font-mono text-sm">
            Key Name <span class="text-status-error">*</span>
          </label>
          <input
            type="text"
            bind:value={importKeyName}
            placeholder="Enter name for imported key"
            disabled={loading}
            class="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary font-mono text-sm disabled:opacity-50"
          />
        </div>

        <div class="mb-4">
          <label class="block text-text font-medium mb-2 font-mono text-sm">
            Private Key (PEM format) <span class="text-status-error">*</span>
          </label>
          <textarea
            bind:value={importKeyContent}
            rows="6"
            placeholder="-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----"
            disabled={loading}
            class="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary font-mono text-sm disabled:opacity-50 resize-y"
          ></textarea>
          <p class="text-text-muted text-xs mt-1">
            💡 If the key is password-protected, you'll be prompted for the password when using it for authentication.
          </p>
        </div>

        <button
          onclick={handleImportKey}
          disabled={loading || !importKeyName.trim() || !importKeyContent.trim()}
          class="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Importing...' : 'Import Key'}
        </button>
      </div>
    </div>
  {/if}

  <!-- Setup Instructions -->
  {#if showInstructions && instructionsKeyId}
    <div class="bg-surface border border-border rounded-lg p-6 mb-8">
      <div class="flex items-center justify-between mb-6">
        <h4 class="text-primary font-mono text-lg font-semibold flex items-center gap-2">
          📋 Setup Instructions
        </h4>
        <button
          onclick={() => showInstructions = false}
          class="w-8 h-8 flex items-center justify-center text-text-muted hover:text-primary hover:bg-bg rounded transition-colors"
          title="Close instructions"
        >
          ✕
        </button>
      </div>
      <div class="space-y-6">
        <div class="bg-bg border border-border rounded-lg p-4">
          <p class="text-text-muted text-sm mb-3 font-medium">
            1. Add the public key to your authorized_keys file:
          </p>
          <div class="relative">
            <pre class="bg-secondary p-3 rounded-lg text-xs overflow-x-auto text-primary pr-20 font-mono">
{keys.find(k => k.id === instructionsKeyId)?.publicKey ?
  `echo "${keys.find(k => k.id === instructionsKeyId)?.publicKey}" >> ~/.ssh/authorized_keys` :
  'Loading...'
}</pre>
            <button
              onclick={async () => {
                const key = keys.find(k => k.id === instructionsKeyId);
                if (key) {
                  const command = `echo "${key.publicKey}" >> ~/.ssh/authorized_keys`;
                  await navigator.clipboard.writeText(command);
                  success = 'Command copied to clipboard!';
                }
              }}
              class="absolute top-2 right-2 btn-ghost text-xs"
              title="Copy command"
            >
              📋
            </button>
          </div>
        </div>
        <div class="bg-bg border border-border rounded-lg p-4">
          <p class="text-text-muted text-sm mb-3 font-medium">2. Or copy the public key:</p>
          <div class="relative">
            <pre class="bg-secondary p-3 rounded-lg text-xs overflow-x-auto text-primary pr-20 font-mono">
{keys.find(k => k.id === instructionsKeyId)?.publicKey ?
  keys.find(k => k.id === instructionsKeyId)?.publicKey :
  'Loading...'
}</pre>
            <button
              onclick={async () => {
                const key = keys.find(k => k.id === instructionsKeyId);
                if (key) {
                  await navigator.clipboard.writeText(key.publicKey);
                  success = 'Public key copied to clipboard!';
                }
              }}
              class="absolute top-2 right-2 btn-ghost text-xs"
              title="Copy to clipboard"
            >
              📋 Copy
            </button>
          </div>
        </div>
        <div class="bg-status-info/10 border border-status-info/30 rounded-lg p-3">
          <p class="text-status-info text-sm font-mono flex items-center gap-2">
            💡 <strong>Tip:</strong> Make sure ~/.ssh/authorized_keys has correct permissions (600)
          </p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Sort Controls -->
  <div class="flex items-center gap-4 mb-4">
    <span class="text-text-muted font-mono text-sm">Sort by:</span>
    <div class="flex gap-2">
      <button
        onclick={() => toggleSort('name')}
        class="px-3 py-1 text-sm font-mono rounded border {sortBy === 'name' ? 'border-primary text-primary' : 'border-border text-text-muted hover:border-primary/50'} transition-colors"
      >
        Name {sortBy === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
      </button>
      <button
        onclick={() => toggleSort('date')}
        class="px-3 py-1 text-sm font-mono rounded border {sortBy === 'date' ? 'border-primary text-primary' : 'border-border text-text-muted hover:border-primary/50'} transition-colors"
      >
        Date {sortBy === 'date' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
      </button>
      <button
        onclick={() => toggleSort('type')}
        class="px-3 py-1 text-sm font-mono rounded border {sortBy === 'type' ? 'border-primary text-primary' : 'border-border text-text-muted hover:border-primary/50'} transition-colors"
      >
        Type {sortBy === 'type' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
      </button>
    </div>
  </div>

  <!-- Keys List -->
  <div class="space-y-4">
    {#if loading && keys.length === 0}
      <div class="text-center py-12 text-text-muted">
        <div class="text-4xl mb-4">🔄</div>
        <p class="font-mono text-lg mb-2 text-primary">Loading SSH keys...</p>
      </div>
    {:else if filteredKeys.length === 0}
      <div class="text-center py-12 text-text-muted border border-border rounded-lg bg-surface">
        <div class="text-4xl mb-4">{searchQuery ? '🔍' : '🔑'}</div>
        <p class="font-mono text-lg mb-2 text-primary">
          {searchQuery ? 'No keys found' : 'No SSH keys found'}
        </p>
        <p class="text-sm">
          {searchQuery ? 'Try adjusting your search query' : 'Generate or import a key to get started'}
        </p>
      </div>
    {:else}
      {#each filteredKeys as key (key.id)}
        <div class="ssh-key-item border border-border rounded-lg p-4 bg-surface hover:bg-surface-hover transition-colors">
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-2">
                <h4 class="font-mono font-semibold text-primary truncate">{key.name}</h4>
                <span class="badge badge-ed25519 px-2 py-1 text-xs font-mono rounded">
                  {getKeyTypeDisplay(key.type, key.size)}
                </span>
                {#if !key.hasPrivateKey}
                  <span class="badge bg-status-warning/10 text-status-warning border border-status-warning/30 px-2 py-1 text-xs font-mono rounded">
                    🔓 Public Only
                  </span>
                {/if}
              </div>
              <div class="text-sm text-text-muted font-mono space-y-1">
                <div class="flex items-center gap-2">
                  <span>ID: {key.id}</span>
                  <button
                    onclick={() => handleCopyFingerprint(key)}
                    class="text-xs text-text-muted hover:text-primary"
                    title="Copy fingerprint"
                  >
                    📋
                  </button>
                </div>
                <div>Fingerprint: {key.fingerprint}</div>
                <div>Created: {new Date(key.created).toLocaleString()}</div>
                {#if key.comment}
                  <div>Comment: {key.comment}</div>
                {/if}
              </div>
              <div class="mt-2 text-xs text-text-muted font-mono bg-bg p-2 rounded truncate">
                {truncatePublicKey(key.publicKey)}
              </div>
            </div>
            <div class="flex flex-col gap-2 ml-4">
              <button
                onclick={() => handleDownloadPublicKey(key.id, key.name)}
                class="btn-ghost text-xs p-2"
                title="Download Public Key"
              >
                📥 Public
              </button>
              <button
                onclick={() => handleCopyPublicKey(key.id)}
                class="btn-ghost text-xs p-2"
                title="Copy Public Key"
              >
                📋 Copy
              </button>
              {#if key.hasPrivateKey}
                <button
                  onclick={() => handleTestKey(key.id, key.name)}
                  class="btn-ghost text-xs p-2"
                  title="Test Key"
                >
                  🧪 Test
                </button>
              {/if}
              <button
                onclick={() => handleDeleteKey(key.id, key.name)}
                class="btn-ghost text-xs p-2 text-status-error hover:bg-status-error hover:text-bg"
                title="Remove Key"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</ModalWrapper>

<style>
  .btn-primary {
    @apply bg-primary text-bg px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50;
  }

  .btn-secondary {
    @apply bg-surface text-primary border border-border px-4 py-2 rounded-lg font-medium hover:bg-surface-hover transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50;
  }

  .btn-ghost {
    @apply text-text-muted hover:text-primary hover:bg-surface px-2 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50;
  }

  .badge-ed25519 {
    @apply bg-primary/10 text-primary border border-primary/30;
  }
</style>