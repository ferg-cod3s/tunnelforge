import { writable, derived } from 'svelte/store';

const BREAKPOINTS = {
  MOBILE: 768,
  DESKTOP: 1024,
};

export interface MediaQueryState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

function createMediaStore() {
  const { subscribe, set } = writable<MediaQueryState>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
  });

  if (typeof window !== 'undefined') {
    const updateState = () => {
      const width = window.innerWidth;
      set({
        isMobile: width < BREAKPOINTS.MOBILE,
        isTablet: width >= BREAKPOINTS.MOBILE && width < BREAKPOINTS.DESKTOP,
        isDesktop: width >= BREAKPOINTS.DESKTOP,
      });
    };

    updateState();

    const resizeObserver = new ResizeObserver(updateState);
    resizeObserver.observe(document.documentElement);
  }

  return { subscribe };
}

export const mediaQuery = createMediaStore();
export const isMobile = derived(mediaQuery, $m => $m.isMobile);
