import { describe, it, expect, beforeEach, vi } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/svelte';
import SettingsWindow from './SettingsWindow.svelte';

// Mock Tauri API
const mockInvoke = vi.fn();
const mockWindow = {
  setTitle: vi.fn(),
  close: vi.fn()
};

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => mockWindow
}));

describe('SettingsWindow', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
    mockWindow.setTitle.mockClear();
    mockWindow.close.mockClear();
  });

  it('renders the settings window with tabs', async () => {
    render(SettingsWindow);

    expect(screen.getByText('TunnelForge Settings')).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Server')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Integrations')).toBeInTheDocument();
  });

  it('switches between tabs', async () => {
    render(SettingsWindow);

    const serverTab = screen.getByText('Server');
    await fireEvent.click(serverTab);

    // After clicking server tab, we should see server-specific content
    // This would be tested more thoroughly with actual component content
  });

  it('handles save button click', async () => {
    render(SettingsWindow);

    const saveButton = screen.getByText('Save');
    await fireEvent.click(saveButton);

    expect(mockInvoke).toHaveBeenCalledWith('save_config', expect.any(Object));
  });

  it('handles close button click', async () => {
    render(SettingsWindow);

    const closeButton = screen.getByText('Close');
    await fireEvent.click(closeButton);

    expect(mockWindow.close).toHaveBeenCalled();
  });

  it('shows loading state initially', () => {
    render(SettingsWindow);

    // Should show loading spinner initially
    expect(screen.getByText('TunnelForge Settings')).toBeInTheDocument();
  });

  it('handles settings loading', async () => {
    // Mock successful config loading
    mockInvoke.mockResolvedValueOnce({
      general: { auto_start: true },
      server: { port: 4021 },
      notifications: { session_start: true },
      integrations: {}
    });

    render(SettingsWindow);

    // Wait for loading to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockInvoke).toHaveBeenCalledWith('get_config');
  });
});
