import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { TunnelAPIService } from './tunnel-service.js';

describe('TunnelAPIService', () => {
  let service: TunnelAPIService;
  let mockFetch: ReturnType<typeof mock>;

  beforeEach(() => {
    mockFetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
        statusText: 'OK',
      } as Response)
    );
    global.fetch = mockFetch as any;
    service = new TunnelAPIService();
  });

  describe('listTunnelServices', () => {
    it('should fetch tunnel services', async () => {
      const mockServices = {
        tunnels: {
          cloudflare: { type: 'cloudflare', running: false },
          ngrok: { type: 'ngrok', running: false },
        }
      };
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockServices),
        } as Response)
      );

      const result = await service.listTunnelServices();

      expect(result).toEqual(Object.values(mockServices.tunnels));
      expect(mockFetch).toHaveBeenCalledWith('/api/tunnels', expect.any(Object));
    });
  });

  describe('startTunnel', () => {
    it('should start a quick tunnel', async () => {
      const mockResponse = { url: 'https://test.trycloudflare.com' };
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)
      );

      const result = await service.startTunnel({ type: 'quick', port: 3000 });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/tunnels/cloudflare/start',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ port: 3000 }),
        })
      );
    });

    it('should throw error on failure', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          ok: false,
          statusText: 'Bad Request',
          json: () => Promise.resolve({ error: 'Invalid port' }),
        } as Response)
      );

      await expect(service.startTunnel({ type: 'quick', port: -1 })).rejects.toThrow(
        'Invalid port'
      );
    });
  });

  describe('stopTunnel', () => {
    it('should stop tunnel', async () => {
      await service.stopTunnel();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/tunnels/cloudflare/stop',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('getCloudflareStatus', () => {
    it('should get tunnel status', async () => {
      const mockStatus = { running: true, type: 'quick', url: 'https://test.trycloudflare.com' };
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockStatus),
        } as Response)
      );

      const result = await service.getCloudflareStatus();

      expect(result).toEqual(mockStatus);
    });
  });

  describe('isCloudflareInstalled', () => {
    it('should check if cloudflared is installed', async () => {
      const mockServices = { 
        tunnels: { 
          cloudflare: { type: 'cloudflare', running: false }
        } 
      };
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockServices),
        } as Response)
      );

      const result = await service.isCloudflareInstalled();

      expect(result.installed).toBe(false);
    });
  });

  describe('with authClient', () => {
    it('should include authorization header', async () => {
      const authClient = { token: 'test-token' };
      service = new TunnelAPIService(authClient as any);

      await service.listTunnelServices();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/tunnels',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });
  });
});
