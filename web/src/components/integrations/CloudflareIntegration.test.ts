import { describe, it, expect, beforeEach, vi } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/svelte';
import CloudflareIntegration from './CloudflareIntegration.svelte';

// Mock Tauri API
const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke
}));

describe('CloudflareIntegration', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
  });

  it('renders Cloudflare integration section', () => {
    render(CloudflareIntegration);

    expect(screen.getByText('☁️')).toBeInTheDocument();
    expect(screen.getByText('Cloudflare Quick Tunnels')).toBeInTheDocument();
    expect(screen.getByText('Create secure tunnels to expose your local development server to the internet using Cloudflare')).toBeInTheDocument();
  });

  it('shows not installed status initially', async () => {
    // Mock not installed status
    mockInvoke.mockResolvedValueOnce({
      is_installed: false,
      is_running: false,
      public_url: null,
      status_error: null
    });

    render(CloudflareIntegration);

    // Wait for status to load
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(screen.getByText('Status: Not Installed')).toBeInTheDocument();
    expect(screen.getByText('Installation Required')).toBeInTheDocument();
  });

  it('shows installation options when not installed', async () => {
    mockInvoke.mockResolvedValueOnce({
      is_installed: false,
      is_running: false,
      public_url: null,
      status_error: null
    });

    render(CloudflareIntegration);

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(screen.getByText('Install via Homebrew')).toBeInTheDocument();
    expect(screen.getByText('Download')).toBeInTheDocument();
    expect(screen.getByText('Setup Guide')).toBeInTheDocument();
  });

  it('shows installed status when cloudflared is available', async () => {
    mockInvoke.mockResolvedValueOnce({
      is_installed: true,
      is_running: false,
      public_url: null,
      status_error: null
    });

    render(CloudflareIntegration);

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(screen.getByText('Status: Installed')).toBeInTheDocument();
  });

  it('shows running status with public URL', async () => {
    mockInvoke.mockResolvedValueOnce({
      is_installed: true,
      is_running: true,
      public_url: 'https://test.trycloudflare.com',
      status_error: null
    });

    render(CloudflareIntegration);

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(screen.getByText('Status: Running')).toBeInTheDocument();
    expect(screen.getByText('Public URL:')).toBeInTheDocument();
    expect(screen.getByText('https://test.trycloudflare.com')).toBeInTheDocument();
  });

  it('handles tunnel start button click', async () => {
    // Mock installed status
    mockInvoke.mockResolvedValueOnce({
      is_installed: true,
      is_running: false,
      public_url: null,
      status_error: null
    });

    // Mock successful tunnel start
    mockInvoke.mockResolvedValueOnce('https://new-tunnel.trycloudflare.com');

    render(CloudflareIntegration);

    await new Promise(resolve => setTimeout(resolve, 100));

    const startButton = screen.getByText('Start Tunnel');
    await fireEvent.click(startButton);

    expect(mockInvoke).toHaveBeenCalledWith('start_cloudflare_tunnel', { port: 4021 });
  });

  it('handles tunnel stop button click', async () => {
    // Mock running status
    mockInvoke.mockResolvedValueOnce({
      is_installed: true,
      is_running: true,
      public_url: 'https://test.trycloudflare.com',
      status_error: null
    });

    render(CloudflareIntegration);

    await new Promise(resolve => setTimeout(resolve, 100));

    const stopButton = screen.getByText('Stop Tunnel');
    await fireEvent.click(stopButton);

    expect(mockInvoke).toHaveBeenCalledWith('stop_cloudflare_tunnel');
  });

  it('handles port input changes', async () => {
    mockInvoke.mockResolvedValueOnce({
      is_installed: true,
      is_running: false,
      public_url: null,
      status_error: null
    });

    render(CloudflareIntegration);

    await new Promise(resolve => setTimeout(resolve, 100));

    const portInput = screen.getByDisplayValue('4021');
    await fireEvent.change(portInput, { target: { value: '8080' } });

    expect(portInput.value).toBe('8080');
  });

  it('handles refresh button click', async () => {
    mockInvoke.mockResolvedValueOnce({
      is_installed: true,
      is_running: false,
      public_url: null,
      status_error: null
    });

    render(CloudflareIntegration);

    await new Promise(resolve => setTimeout(resolve, 100));

    const refreshButton = screen.getByText('Refresh');
    await fireEvent.click(refreshButton);

    expect(mockInvoke).toHaveBeenCalledWith('get_cloudflare_status');
  });

  it('handles installation button clicks', async () => {
    mockInvoke.mockResolvedValueOnce({
      is_installed: false,
      is_running: false,
      public_url: null,
      status_error: null
    });

    render(CloudflareIntegration);

    await new Promise(resolve => setTimeout(resolve, 100));

    const homebrewButton = screen.getByText('Install via Homebrew');
    const downloadButton = screen.getByText('Download');
    const setupButton = screen.getByText('Setup Guide');

    await fireEvent.click(homebrewButton);
    await fireEvent.click(downloadButton);
    await fireEvent.click(setupButton);

    expect(mockInvoke).toHaveBeenCalledWith('open_cloudflare_homebrew');
    expect(mockInvoke).toHaveBeenCalledWith('open_cloudflare_download');
    expect(mockInvoke).toHaveBeenCalledWith('open_cloudflare_setup_guide');
  });
});
