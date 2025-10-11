/**
 * File Picker Store for controlling file picker visibility and state
 */

import { writable } from 'svelte/store';

interface FilePickerState {
  visible: boolean;
  directSelect: boolean;
}

function createFilePickerStore() {
  const { subscribe, set, update } = writable<FilePickerState>({
    visible: false,
    directSelect: false,
  });

  return {
    subscribe,
    showDialog: () => update(state => ({ ...state, visible: true, directSelect: false })),
    hideDialog: () => set({ visible: false, directSelect: false }),
    showDirectSelect: () => update(state => ({ ...state, visible: true, directSelect: true })),
    reset: () => set({ visible: false, directSelect: false }),
  };
}

export const filePickerStore = createFilePickerStore();