// Connection Logger for TunnelForge Desktop App
// This script logs all connection attempts and failures for debugging

(function() {
    'use strict';
    
    // Enhanced fetch wrapper to log all API calls
    const originalFetch = window.fetch;
    const originalWebSocket = window.WebSocket;
    
    // Log fetch requests
    window.fetch = function(...args) {
        const [url, options] = args;
        const startTime = Date.now();
        
        console.log('[FETCH-REQUEST]', {
            url: url,
            method: options?.method || 'GET',
            headers: options?.headers,
            timestamp: new Date().toISOString()
        });
        
        return originalFetch.apply(this, args)
            .then(response => {
                const duration = Date.now() - startTime;
                console.log('[FETCH-RESPONSE]', {
                    url: url,
                    status: response.status,
                    statusText: response.statusText,
                    duration: duration + 'ms',
                    timestamp: new Date().toISOString()
                });
                
                if (!response.ok) {
                    console.error('[FETCH-ERROR]', {
                        url: url,
                        status: response.status,
                        statusText: response.statusText,
                        timestamp: new Date().toISOString()
                    });
                }
                
                return response;
            })
            .catch(error => {
                const duration = Date.now() - startTime;
                console.error('[FETCH-ERROR]', {
                    url: url,
                    error: error.message,
                    duration: duration + 'ms',
                    timestamp: new Date().toISOString()
                });
                throw error;
            });
    };
    
    // Log WebSocket connections
    window.WebSocket = function(url, protocols) {
        console.log('[WEBSOCKET-CONNECT]', {
            url: url,
            protocols: protocols,
            timestamp: new Date().toISOString()
        });
        
        const ws = new originalWebSocket(url, protocols);
        
        const originalOnOpen = ws.onopen;
        const originalOnClose = ws.onclose;
        const originalOnError = ws.onerror;
        const originalOnMessage = ws.onmessage;
        
        ws.onopen = function(event) {
            console.log('[WEBSOCKET-OPEN]', {
                url: url,
                event: event,
                timestamp: new Date().toISOString()
            });
            if (originalOnOpen) originalOnOpen.call(this, event);
        };
        
        ws.onclose = function(event) {
            console.log('[WEBSOCKET-CLOSE]', {
                url: url,
                code: event.code,
                reason: event.reason,
                wasClean: event.wasClean,
                timestamp: new Date().toISOString()
            });
            if (originalOnClose) originalOnClose.call(this, event);
        };
        
        ws.onerror = function(event) {
            console.error('[WEBSOCKET-ERROR]', {
                url: url,
                event: event,
                timestamp: new Date().toISOString()
            });
            if (originalOnError) originalOnError.call(this, event);
        };
        
        ws.onmessage = function(event) {
            console.log('[WEBSOCKET-MESSAGE]', {
                url: url,
                data: event.data,
                timestamp: new Date().toISOString()
            });
            if (originalOnMessage) originalOnMessage.call(this, event);
        };
        
        return ws;
    };
    
    // Log XMLHttpRequest for completeness
    const originalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
        const xhr = new originalXHR();
        const originalOpen = xhr.open;
        const originalSend = xhr.send;
        
        xhr.open = function(method, url, ...args) {
            console.log('[XHR-OPEN]', {
                method: method,
                url: url,
                timestamp: new Date().toISOString()
            });
            return originalOpen.call(this, method, url, ...args);
        };
        
        xhr.send = function(data) {
            console.log('[XHR-SEND]', {
                data: data,
                timestamp: new Date().toISOString()
            });
            
            const originalOnReadyStateChange = xhr.onreadystatechange;
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    console.log('[XHR-RESPONSE]', {
                        status: xhr.status,
                        statusText: xhr.statusText,
                        timestamp: new Date().toISOString()
                    });
                }
                if (originalOnReadyStateChange) {
                    originalOnReadyStateChange.call(this);
                }
            };
            
            return originalSend.call(this, data);
        };
        
        return xhr;
    };
    
    // Log page load and Tauri detection
    console.log('[CONNECTION-LOGGER] Initialized', {
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
    });
    
    // Check for Tauri API
    if (window.__TAURI__) {
        console.log('[TAURI-DETECTED]', {
            available: true,
            timestamp: new Date().toISOString()
        });
    } else {
        console.warn('[TAURI-NOT-DETECTED]', {
            available: false,
            timestamp: new Date().toISOString()
        });
    }
    
    // Test basic connectivity
    setTimeout(() => {
        console.log('[CONNECTIVITY-TEST]', {
            testing: 'basic connectivity',
            timestamp: new Date().toISOString()
        });
        
        // Test common endpoints
        const testEndpoints = [
            '/health',
            '/api/auth/config',
            '/api/sessions',
            '/'
        ];
        
        testEndpoints.forEach(endpoint => {
            fetch(endpoint)
                .then(response => {
                    console.log('[CONNECTIVITY-RESULT]', {
                        endpoint: endpoint,
                        status: response.status,
                        success: response.ok,
                        timestamp: new Date().toISOString()
                    });
                })
                .catch(error => {
                    console.error('[CONNECTIVITY-ERROR]', {
                        endpoint: endpoint,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });
                });
        });
    }, 1000);
    
})();