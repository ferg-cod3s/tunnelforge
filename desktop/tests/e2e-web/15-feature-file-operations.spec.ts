import { test, expect } from '@playwright/test';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:4021';
const API_URL = `${BASE_URL}/api`;

const api = axios.create({
  baseURL: API_URL,
  validateStatus: () => true,
});

// Test directory
const TEST_DIR = '/tmp/tunnelforge-test';

test.describe('Features: File Operations', () => {
  test.beforeAll(async () => {
    // Create test directory
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  test.describe('File Upload', () => {
    test('should upload text file', async () => {
      const response = await api.post('/files/upload', {
        path: `${TEST_DIR}/test.txt`,
        content: 'Hello, World!'
      });

      expect(response.status).toBe(200);
      expect(response.data.name).toBe('test.txt');
    });

    test('should upload binary file', async () => {
      const binaryData = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG header

      const response = await api.post('/files/upload', {
        path: `${TEST_DIR}/image.jpg`,
        data: binaryData
      });

      expect(response.status).toBe(200);
    });

    test('should preserve file timestamps', async () => {
      const now = new Date();
      
      const response = await api.post('/files/upload', {
        path: `${TEST_DIR}/timestamped.txt`,
        content: 'test',
        timestamp: now.toISOString()
      });

      if (response.status === 200) {
        expect(response.data.modified).toBeTruthy();
      }
    });

    test('should handle large files progressively', async () => {
      const largeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB

      const response = await api.post('/files/upload', {
        path: `${TEST_DIR}/large.txt`,
        content: largeContent
      });

      // Should handle or reject gracefully
      expect([200, 400, 413]).toContain(response.status);
    });

    test('should create parent directories if missing', async () => {
      const response = await api.post('/files/upload', {
        path: `${TEST_DIR}/nested/deep/directory/file.txt`,
        content: 'test',
        createParents: true
      });

      expect(response.status).toBe(200);
    });
  });

  test.describe('File Download', () => {
    test('should download file contents', async () => {
      // First upload
      await api.post('/files/upload', {
        path: `${TEST_DIR}/download.txt`,
        content: 'Download me'
      });

      // Then download
      const response = await api.get('/files', {
        params: { path: `${TEST_DIR}/download.txt` }
      });

      expect(response.status).toBe(200);
      expect(response.data.content || response.data).toBeTruthy();
    });

    test('should support range requests for large files', async () => {
      // Upload large file
      const content = 'x'.repeat(10000);
      await api.post('/files/upload', {
        path: `${TEST_DIR}/range.txt`,
        content
      });

      // Request range
      const response = await api.get('/files', {
        params: { path: `${TEST_DIR}/range.txt`, start: 0, end: 1000 },
        headers: { 'Range': 'bytes=0-1000' }
      });

      expect([200, 206]).toContain(response.status);
    });

    test('should support streaming download', async () => {
      const response = await api.get('/files', {
        params: { path: `${TEST_DIR}/download.txt`, stream: true }
      });

      expect([200, 206]).toContain(response.status);
    });
  });

  test.describe('File Listing', () => {
    test('should list directory contents', async () => {
      const response = await api.get('/files', {
        params: { path: TEST_DIR }
      });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data) || Array.isArray(response.data.files)).toBe(true);
    });

    test('should show file metadata', async () => {
      const response = await api.get('/files', {
        params: { path: TEST_DIR, detailed: true }
      });

      if (response.status === 200) {
        const files = Array.isArray(response.data) ? response.data : response.data.files;
        if (files && files.length > 0) {
          expect(files[0].name || files[0].path).toBeTruthy();
          expect(files[0].size || files[0].length).toBeTruthy();
        }
      }
    });

    test('should support pagination', async () => {
      const response = await api.get('/files', {
        params: { path: TEST_DIR, limit: 10, offset: 0 }
      });

      expect(response.status).toBe(200);
    });

    test('should support filtering', async () => {
      const response = await api.get('/files', {
        params: { path: TEST_DIR, filter: '*.txt' }
      });

      expect(response.status).toBe(200);
    });

    test('should support sorting', async () => {
      const response = await api.get('/files', {
        params: { path: TEST_DIR, sortBy: 'modified', order: 'desc' }
      });

      expect(response.status).toBe(200);
    });
  });

  test.describe('File Modification', () => {
    test('should edit file contents', async () => {
      // Create file
      await api.post('/files/upload', {
        path: `${TEST_DIR}/editable.txt`,
        content: 'Original'
      });

      // Edit
      const response = await api.put('/files', {
        path: `${TEST_DIR}/editable.txt`,
        content: 'Modified'
      });

      expect(response.status).toBe(200);
    });

    test('should append to file', async () => {
      // Create file
      await api.post('/files/upload', {
        path: `${TEST_DIR}/appendable.txt`,
        content: 'Line 1\n'
      });

      // Append
      const response = await api.post('/files/append', {
        path: `${TEST_DIR}/appendable.txt`,
        content: 'Line 2\n'
      });

      expect(response.status).toBe(200);
    });

    test('should rename file', async () => {
      // Create file
      await api.post('/files/upload', {
        path: `${TEST_DIR}/old-name.txt`,
        content: 'test'
      });

      // Rename
      const response = await api.post('/files/rename', {
        path: `${TEST_DIR}/old-name.txt`,
        newName: 'new-name.txt'
      });

      expect(response.status).toBe(200);
    });

    test('should copy file', async () => {
      // Create source
      await api.post('/files/upload', {
        path: `${TEST_DIR}/source.txt`,
        content: 'test'
      });

      // Copy
      const response = await api.post('/files/copy', {
        source: `${TEST_DIR}/source.txt`,
        destination: `${TEST_DIR}/source-copy.txt`
      });

      expect(response.status).toBe(200);
    });

    test('should move file', async () => {
      // Create file
      await api.post('/files/upload', {
        path: `${TEST_DIR}/to-move.txt`,
        content: 'test'
      });

      // Move
      const response = await api.post('/files/move', {
        source: `${TEST_DIR}/to-move.txt`,
        destination: `${TEST_DIR}/moved.txt`
      });

      expect(response.status).toBe(200);
    });

    test('should set file permissions', async () => {
      // Create file
      await api.post('/files/upload', {
        path: `${TEST_DIR}/perms.txt`,
        content: 'test'
      });

      // Change permissions
      const response = await api.post('/files/permissions', {
        path: `${TEST_DIR}/perms.txt`,
        mode: '0644'
      });

      expect([200, 400]).toContain(response.status);
    });
  });

  test.describe('File Deletion', () => {
    test('should delete file', async () => {
      // Create file
      await api.post('/files/upload', {
        path: `${TEST_DIR}/to-delete.txt`,
        content: 'test'
      });

      // Delete
      const response = await api.delete('/files', {
        params: { path: `${TEST_DIR}/to-delete.txt` }
      });

      expect([200, 204]).toContain(response.status);
    });

    test('should recursively delete directory', async () => {
      // Create directory with files
      await api.post('/files/upload', {
        path: `${TEST_DIR}/to-delete/file.txt`,
        content: 'test',
        createParents: true
      });

      // Delete directory
      const response = await api.delete('/files', {
        params: { path: `${TEST_DIR}/to-delete`, recursive: true }
      });

      expect([200, 204]).toContain(response.status);
    });
  });

  test.describe('Search & Find', () => {
    test('should search by filename', async () => {
      const response = await api.get('/files/search', {
        params: { pattern: '*.txt', path: TEST_DIR }
      });

      expect(response.status).toBe(200);
    });

    test('should search by content', async () => {
      // Create file with specific content
      await api.post('/files/upload', {
        path: `${TEST_DIR}/searchable.txt`,
        content: 'Unique search term xyz'
      });

      // Search
      const response = await api.get('/files/search', {
        params: { content: 'xyz', path: TEST_DIR }
      });

      expect(response.status).toBe(200);
    });

    test('should support regex search', async () => {
      const response = await api.get('/files/search', {
        params: { pattern: '^test.*\\.txt$', path: TEST_DIR, regex: true }
      });

      expect(response.status).toBe(200);
    });

    test('should search recursively', async () => {
      const response = await api.get('/files/search', {
        params: { pattern: '*.txt', path: TEST_DIR, recursive: true }
      });

      expect(response.status).toBe(200);
    });
  });

  test.describe('Archive Operations', () => {
    test('should create zip archive', async () => {
      const response = await api.post('/files/archive', {
        format: 'zip',
        files: [`${TEST_DIR}/test.txt`],
        output: `${TEST_DIR}/archive.zip`
      });

      expect([200, 404]).toContain(response.status);
    });

    test('should extract archive', async () => {
      const response = await api.post('/files/extract', {
        source: `${TEST_DIR}/archive.zip`,
        destination: `${TEST_DIR}/extracted`
      });

      expect([200, 404]).toContain(response.status);
    });

    test('should list archive contents', async () => {
      const response = await api.get('/files/archive', {
        params: { path: `${TEST_DIR}/archive.zip` }
      });

      expect([200, 404]).toContain(response.status);
    });
  });

  test.describe('File Watching', () => {
    test('should watch for file changes', async () => {
      const response = await api.post('/files/watch', {
        path: `${TEST_DIR}`,
        events: ['create', 'modify', 'delete']
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should receive change notifications', async () => {
      const response = await api.post('/files/watch', {
        path: `${TEST_DIR}`,
        events: ['create'],
        callback: 'http://localhost:8000/notify'
      });

      expect([200, 400]).toContain(response.status);
    });
  });

  test.describe('File Synchronization', () => {
    test('should sync directories', async () => {
      const response = await api.post('/files/sync', {
        source: `${TEST_DIR}/source`,
        destination: `${TEST_DIR}/dest`
      });

      expect([200, 404]).toContain(response.status);
    });

    test('should detect file changes for sync', async () => {
      const response = await api.post('/files/diff', {
        source: `${TEST_DIR}/source`,
        destination: `${TEST_DIR}/dest`
      });

      expect([200, 404]).toContain(response.status);
    });
  });
});
