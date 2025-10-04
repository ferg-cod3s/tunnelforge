<script lang="ts" context="module">
export type Theme = 'light' | 'dark' | 'system';
</script>

<script lang="ts">
import { onMount, onDestroy } from 'svelte';

let { theme = $bindable('system' as Theme) } = $props();

const STORAGE_KEY = 'tunnelforge-theme';
let mediaQuery: MediaQueryList | undefined = $state();

onMount(() => {
  const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
  theme = saved || 'system';

  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', handleSystemThemeChange);

  applyTheme();
});

onDestroy(() => {
  mediaQuery?.removeEventListener('change', handleSystemThemeChange);
});

function handleSystemThemeChange() {
  if (theme === 'system') {
    applyTheme();
  }
}

function applyTheme() {
  const root = document.documentElement;
  let effectiveTheme: 'light' | 'dark';

  if (theme === 'system') {
    effectiveTheme = mediaQuery?.matches ? 'dark' : 'light';
  } else {
    effectiveTheme = theme;
  }

  root.setAttribute('data-theme', effectiveTheme);

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', effectiveTheme === 'dark' ? '#1A1A1A' : '#fafafa');
  }
}

function cycleTheme() {
  const themes: Theme[] = ['light', 'dark', 'system'];
  const currentIndex = themes.indexOf(theme);
  const nextIndex = (currentIndex + 1) % themes.length;
  theme = themes[nextIndex];

  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme();

  const event = new CustomEvent('theme-changed', {
    detail: { theme },
    bubbles: true,
  });
  document.dispatchEvent(event);
}

const icon = $derived.by(() => {
  switch (theme) {
    case 'light':
      return 'M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z';
    case 'dark':
      return 'M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z';
    case 'system':
      return 'M10 2C5.858 2 2.5 5.358 2.5 9.5S5.858 17 10 17s7.5-3.358 7.5-7.5S14.142 2 10 2zM10 15.5V4.5c3.314 0 6 2.686 6 6s-2.686 6-6 6z';
  }
});

const tooltip = $derived.by(() => {
  const current =
    theme === 'system'
      ? 'Auto (System)'
      : theme.charAt(0).toUpperCase() + theme.slice(1);
  const next = theme === 'light' ? 'Dark' : theme === 'dark' ? 'Auto' : 'Light';
  return `Theme: ${current} (click for ${next})`;
});
</script>

<button
  onclick={cycleTheme}
  class="bg-bg-tertiary border border-border rounded-lg p-2 font-mono text-muted transition-all duration-200 hover:text-primary hover:bg-surface-hover hover:border-primary hover:shadow-sm flex-shrink-0"
  title={tooltip}
  aria-label="Toggle theme"
>
  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
    <path fill-rule="evenodd" d={icon} clip-rule="evenodd" />
  </svg>
</button>
