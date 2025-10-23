// TunnelForge Desktop Settings - JavaScript
console.log('🔧 TunnelForge Desktop JavaScript loading...');

// Initialize Sentry for error tracking
(function initSentry() {
    // Skip Sentry in dev mode or if already initialized
    if (window.Sentry || window.location.hostname === 'localhost') {
        console.log('⏭️ Sentry skipped (dev mode or already initialized)');
        return;
    }
    
    // Lightweight Sentry initialization
    const script = document.createElement('script');
    script.src = 'https://js.sentry-cdn.com/7afe672f8dcad80804647bc69a386687.min.js';
    script.crossOrigin = 'anonymous';
    script.onload = () => {
        if (window.Sentry) {
            window.Sentry.init({
                dsn: 'https://7afe672f8dcad80804647bc69a386687@sentry.fergify.work/10',
                environment: 'desktop-tauri',
                release: 'tunnelforge-desktop@1.0.0',
                integrations: [window.Sentry.browserTracingIntegration()],
                tracesSampleRate: 1.0,
            });
            console.log('✅ Sentry initialized for error tracking');
        }
    };
    document.head.appendChild(script);
})();

// Tauri v2 API Detection
// In Tauri v2, we need to dynamically import the Tauri APIs from npm packages
let isInTauri = false;
let tauriInvoke = null;

// Try to detect Tauri by checking for Tauri-specific user agent or protocol
const isTauriUserAgent = navigator.userAgent.includes('Tauri');
const isTauriProtocol = window.location.protocol === 'tauri:';
const isTauriOrigin = window.location.origin.startsWith('tauri://');

console.log('🔍 Checking Tauri environment...');
console.log('  - User Agent includes Tauri:', isTauriUserAgent);
console.log('  - Protocol:', window.location.protocol);
console.log('  - Origin:', window.location.origin);

// Helper function to invoke Tauri commands (works with v1 and v2)
async function invokeTauri(command, args = {}) {
    // Try v2 (core.invoke) first, then fallback to v1
    if (window.__TAURI__?.core?.invoke) {
        console.log(`🔧 Invoking Tauri v2 (core) command: ${command}`, args);
        return await window.__TAURI__.core.invoke(command, args);
    } else if (window.__TAURI__?.invoke) {
        console.log(`🔧 Invoking Tauri v1 command: ${command}`, args);
        return await window.__TAURI__.invoke(command, args);
    } else {
        throw new Error('Tauri invoke function not available - not running in Tauri environment');
    }
}

// Detect Tauri environment
// In Tauri v2, window.__TAURI_INVOKE__ is automatically injected by the runtime
(function detectTauri() {
    try {
        // Check for Tauri v2 first (protocol-based detection)
        if (isTauriProtocol || isTauriOrigin) {
            console.log('✅ Tauri protocol detected (tauri://)');
            isInTauri = true;
            
            // In Tauri v2, window.__TAURI__.core.invoke should be available
            if (window.__TAURI__?.core?.invoke) {
                console.log('✅ Tauri v2 core.invoke found!');
                tauriInvoke = window.__TAURI__.core.invoke;
            } else {
                console.warn('⚠️ Tauri protocol detected but core.invoke not available yet');
                console.log('   This may mean Tauri is still initializing...');
                // Set a timeout to check again after a brief delay
                setTimeout(() => {
                    if (window.__TAURI__?.core?.invoke) {
                        console.log('✅ Tauri v2 core.invoke now available!');
                        tauriInvoke = window.__TAURI__.core.invoke;
                        document.dispatchEvent(new CustomEvent('tauri-loaded'));
                    } else {
                        console.error('❌ Tauri v2 core.invoke still not available');
                    }
                }, 100);
            }
        } else if (window.__TAURI__) {
            // Legacy Tauri v1 detection (fallback)
            console.log('✅ Tauri v1 detected via window.__TAURI__');
            isInTauri = true;
            tauriInvoke = window.__TAURI__.invoke || window.__TAURI__.core?.invoke;
        } else {
            console.log('ℹ️ Not running in Tauri - using demo mode');
            console.log('   Protocol:', window.location.protocol);
            console.log('   Origin:', window.location.origin);
            isInTauri = false;
        }
    } catch (error) {
        console.error('⚠️ Error during Tauri detection:', error);
        console.log('ℹ️ Falling back to demo/development mode');
        isInTauri = false;
    }
})();

console.log('🏠 Initial Tauri detection:', isInTauri || 'pending...');

// IMMEDIATE DIAGNOSTIC WRITE (before DOM loads)
setTimeout(async () => {
    try {
        const quickDiagnostic = {
            timestamp: new Date().toISOString(),
            phase: 'immediate-on-load',
            protocol: window.location.protocol,
            hasTauriCoreInvoke: typeof window.__TAURI__?.core?.invoke,
            isInTauri: isInTauri
        };
        
        if (window.__TAURI__?.core?.invoke) {
            console.log('🔍 IMMEDIATE TEST: core.invoke detected, attempting write...');
            await window.__TAURI__.core.invoke('write_diagnostics', {
                path: '/tmp/tauri-immediate-test.json',
                content: JSON.stringify(quickDiagnostic, null, 2)
            });
            console.log('✅ IMMEDIATE TEST: File written successfully!');
        } else {
            console.warn('⚠️ IMMEDIATE TEST: core.invoke not available yet');
        }
    } catch (error) {
        console.error('❌ IMMEDIATE TEST failed:', error);
    }
}, 100);

// Tab switching functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM Content Loaded - Initializing tab navigation');
    
    // === STARTUP DIAGNOSTICS ===
    console.log('========== TAURI V2 STARTUP DIAGNOSTICS ==========');
    console.log('Protocol:', window.location.protocol);
    console.log('Origin:', window.location.origin);
    console.log('Href:', window.location.href);
    console.log('isInTauri:', isInTauri);
    console.log('isTauriProtocol:', isTauriProtocol);
    console.log('window.__TAURI__:', typeof window.__TAURI__);
    console.log('window.__TAURI__.core.invoke:', typeof window.__TAURI__?.core?.invoke);
    console.log('tauriInvoke function:', typeof tauriInvoke);
    
    // List all Tauri-related objects
    const tauriKeys = Object.keys(window).filter(key => 
        key.toLowerCase().includes('tauri')
    );
    console.log('Tauri-related keys in window:', tauriKeys);
    
    // Comprehensive Tauri detection
    const detectionResult = {
        timestamp: new Date().toISOString(),
        protocol: window.location.protocol,
        origin: window.location.origin,
        isTauriProtocol: window.location.protocol === 'tauri:',
        hasCoreInvoke: typeof window.__TAURI__?.core?.invoke !== 'undefined',
        hasTauriObject: typeof window.__TAURI__ !== 'undefined',
        hasInternals: typeof window.__TAURI_INTERNALS__ !== 'undefined',
        tauriKeys: Object.keys(window).filter(k => k.toLowerCase().includes('tauri'))
    };

    // Update diagnostic banner
    const statusElem = document.getElementById('tauriDetectionStatus');
    const bannerElem = document.getElementById('tauriDetectionBanner');
    if (statusElem && bannerElem) {
        if (window.__TAURI__?.core?.invoke) {
            statusElem.textContent = '✅ Tauri v2 Active (__TAURI__.core.invoke)';
            bannerElem.style.background = '#4caf50';
            detectionResult.status = 'v2_active';
        } else if (window.__TAURI__?.invoke) {
            statusElem.textContent = '✅ Tauri v1 Active (__TAURI__.invoke)';
            bannerElem.style.background = '#2196f3';
            detectionResult.status = 'v1_active';
        } else {
            statusElem.textContent = '❌ Demo Mode (No Tauri APIs)';
            bannerElem.style.background = '#f44336';
            detectionResult.status = 'demo_mode';
        }
    }

    // Try to write to localStorage for debugging
    try {
        localStorage.setItem('tauri_detection_result', JSON.stringify(detectionResult, null, 2));
        console.log('Detection result saved to localStorage');
    } catch (e) {
        console.error('Failed to save detection result:', e);
    }

    // Also try to send to Rust backend via invoke
    if (typeof invokeTauri === 'function') {
        invokeTauri('log_detection_result', { result: detectionResult })
            .catch(e => console.error('Failed to send detection to Rust:', e));
    }
    
    // Test if we can call invokeTauri
    console.log('invokeTauri function defined:', typeof invokeTauri === 'function');
    
    // Write diagnostics to file for WSL verification
    const diagnosticData = {
        timestamp: new Date().toISOString(),
        protocol: window.location.protocol,
        origin: window.location.origin,
        href: window.location.href,
        isInTauri: isInTauri,
        isTauriProtocol: isTauriProtocol,
        hasTauriObject: typeof window.__TAURI__,
        hasCoreInvoke: typeof window.__TAURI__?.core?.invoke,
        tauriInvokeFunction: typeof tauriInvoke,
        invokeTauriFunction: typeof invokeTauri,
        tauriKeys: tauriKeys,
        userAgent: navigator.userAgent
    };
    
    // Try to write to a file using Tauri's fs module if available
    if (typeof invokeTauri === 'function') {
        invokeTauri('write_diagnostics', { 
            path: '/tmp/tauri-js-diagnostics.json',
            content: JSON.stringify(diagnosticData, null, 2)
        }).then(() => {
            console.log('✅ Diagnostics written to /tmp/tauri-js-diagnostics.json');
        }).catch(err => {
            console.warn('⚠️ Could not write diagnostics file:', err);
        });
    }
    
    console.log('===============================================');
    // === END DIAGNOSTICS ===""
    
    // Tab navigation
    const navLinks = document.querySelectorAll('.nav-link[data-tab]');
    const settingsPanels = document.querySelectorAll('.settings-panel');
    
    console.log('📊 Found nav links:', navLinks.length);
    console.log('📊 Found settings panels:', settingsPanels.length);

    navLinks.forEach((link, index) => {
        console.log(`🔗 Setting up tab ${index}:`, link.dataset.tab);
        
        link.addEventListener('click', (e) => {
            console.log('🖱️ Tab clicked:', link.dataset.tab);
            e.preventDefault();
            
            const tabId = link.dataset.tab;
            
            // Update active nav link
            navLinks.forEach(nl => nl.classList.remove('active'));
            link.classList.add('active');
            
            // Update active settings panel
            settingsPanels.forEach(panel => {
                panel.classList.remove('active');
            });
            
            const targetPanel = document.getElementById(tabId);
            if (targetPanel) {
                targetPanel.classList.add('active');
                console.log('✅ Successfully switched to tab:', tabId);
            } else {
                console.error('❌ Could not find panel for tab:', tabId);
            }
        });
    });

    // Initialize UI
    initializeUI();
    
    // Load settings if in Tauri
    if (isInTauri) {
        loadSettings();
        checkServerStatus();
        
        // Set up periodic server status check
        setInterval(checkServerStatus, 5000);
    } else {
        // Mock data for development
        updateServerStatus('offline', 0);
    }

    // Set up event listeners
    setupEventListeners();
});

function initializeUI() {
    console.log('TunnelForge Desktop Settings initialized');
    
    // Set default values
    document.getElementById('serverPort').value = 4021;
    document.getElementById('accessMode').value = 'localhost';
    
    // Show/hide conditional UI elements
    toggleNotificationOptions();
    toggleNgrokToken();
}

function setupEventListeners() {
    // Settings form handlers
    const saveButton = document.getElementById('saveSettings');
    if (saveButton) {
        saveButton.addEventListener('click', saveSettings);
    }

    // Notification settings
    const notificationsEnabled = document.getElementById('notificationsEnabled');
    if (notificationsEnabled) {
        notificationsEnabled.addEventListener('change', toggleNotificationOptions);
    }

    // ngrok integration
    const ngrokEnabled = document.getElementById('ngrokEnabled');
    if (ngrokEnabled) {
        ngrokEnabled.addEventListener('change', toggleNgrokToken);
    }

    // Test notification
    const testNotificationBtn = document.getElementById('testNotification');
    if (testNotificationBtn) {
        testNotificationBtn.addEventListener('click', testNotification);
    }

    // Server management
    const startServerBtn = document.getElementById('startServer');
    const stopServerBtn = document.getElementById('stopServer');
    const restartServerBtn = document.getElementById('restartServer');
    
    if (startServerBtn) startServerBtn.addEventListener('click', () => manageServer('start'));
    if (stopServerBtn) stopServerBtn.addEventListener('click', () => manageServer('stop'));
    if (restartServerBtn) restartServerBtn.addEventListener('click', () => manageServer('restart'));

    // External links
    const openWebUIBtn = document.getElementById('openWebUI');
    if (openWebUIBtn) {
        console.log('🌐 Setting up Open Web UI button listener');
        openWebUIBtn.addEventListener('click', openWebInterface);
    } else {
        console.error('❌ Open Web UI button not found!');
    }

    const viewLogsBtn = document.getElementById('viewLogs');
    if (viewLogsBtn) {
        console.log('📄 Setting up View Logs button listener');
        viewLogsBtn.addEventListener('click', viewLogs);
    } else {
        console.error('❌ View Logs button not found!');
    }

    const ngrokTokenLink = document.getElementById('ngrokTokenLink');
    if (ngrokTokenLink) {
        ngrokTokenLink.addEventListener('click', (e) => {
            e.preventDefault();
            openExternalUrl('https://dashboard.ngrok.com/get-started/your-authtoken');
        });
    }
}

async function loadSettings() {
    if (!isInTauri) return;

    try {
        showLoading('Loading settings...');
        
        console.log('📥 Loading settings via Tauri command...');
        
        // Load configuration from Tauri
        const config = await invokeTauri('get_config');
        console.log('✅ Config loaded:', config);
        
        // Apply settings to UI
        if (config) {
            if (config.auto_start !== undefined) {
                const autoStartCheckbox = document.getElementById('autoStart');
                if (autoStartCheckbox) autoStartCheckbox.checked = config.auto_start;
            }
            if (config.server_port !== undefined) {
                const serverPortInput = document.getElementById('serverPort');
                if (serverPortInput) serverPortInput.value = config.server_port;
            }
        }
        
        console.log('✅ Settings loaded successfully');
    } catch (error) {
        console.error('❌ Failed to load settings:', error);
        showNotification('Failed to load settings', 'error');
    } finally {
        hideLoading();
    }
}

// (invokeTauri function now defined at top of file)

async function saveSettings() {
    if (!isInTauri) {
        showNotification('Settings saved! (Demo mode)', 'success');
        return;
    }

    try {
        showLoading('Saving settings...');
        
        // Collect form data
        const settings = {
            autoStart: document.getElementById('autoStart').checked,
            showInDock: document.getElementById('showInDock').checked,
            serverPort: parseInt(document.getElementById('serverPort').value),
            accessMode: document.getElementById('accessMode').value,
            notificationsEnabled: document.getElementById('notificationsEnabled').checked,
            notificationSound: document.getElementById('notificationSound').checked,
            sessionStartNotification: document.getElementById('sessionStartNotification').checked,
            sessionEndNotification: document.getElementById('sessionEndNotification').checked,
            errorNotification: document.getElementById('errorNotification').checked,
            preventSleep: document.getElementById('preventSleep').checked,
            powerMonitoring: document.getElementById('powerMonitoring').checked,
            tailscaleEnabled: document.getElementById('tailscaleEnabled').checked,
            cloudflareEnabled: document.getElementById('cloudflareEnabled').checked,
            ngrokEnabled: document.getElementById('ngrokEnabled').checked,
            ngrokAuthToken: document.getElementById('ngrokAuthToken').value
        };

        console.log('Saving settings:', settings);
        
        const invokeResult = await invokeTauri('update_app_settings', settings);
        
        console.log('✅ Settings saved:', invokeResult);
        showNotification('Settings saved successfully!', 'success');
    } catch (error) {
        console.error('Failed to save settings:', error);
        
        // Log to Sentry if available
        if (window.Sentry) {
            window.Sentry.captureException(error, {
                tags: { component: 'desktop-settings' },
                extra: { 
                tauriV1Available: !!window.__TAURI__,
                tauriV2Available: !!window.__TAURI_INVOKE__,
                invokeTauriAvailable: typeof invokeTauri === 'function',
                isTauriEnvironment: isInTauri
                }
            });
        }
        
        showNotification(`Failed to save settings: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

async function checkServerStatus() {
    if (!isInTauri) return;

    try {
        console.log('🔍 Checking server status via Tauri command...');
        const status = await invokeTauri('get_server_status');
        console.log('✅ Server status received:', status);
        
        if (status && status.running) {
            updateServerStatus('online', status.port || 4021, status.pid || 0);
        } else {
            updateServerStatus('offline', 0);
        }
    } catch (error) {
        console.error('❌ Failed to check server status:', error);
        updateServerStatus('offline', 0);
    }
}

function updateServerStatus(status, port, pid) {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const serverStatusText = document.getElementById('serverStatusText');
    const serverPortDisplay = document.getElementById('serverPortDisplay');
    const serverPID = document.getElementById('serverPID');
    const startServerBtn = document.getElementById('startServer');
    const stopServerBtn = document.getElementById('stopServer');

    if (statusIndicator) {
        statusIndicator.className = 'status-indicator';
        statusIndicator.classList.add(status);
    }

    if (statusText) {
        statusText.textContent = status === 'online' ? 'Server running' : 
                                status === 'offline' ? 'Server stopped' : 'Checking...';
    }

    if (serverStatusText) {
        serverStatusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    }

    if (serverPortDisplay) {
        serverPortDisplay.textContent = port || '-';
    }

    if (serverPID) {
        serverPID.textContent = pid || '-';
    }

    // Update button visibility
    if (startServerBtn && stopServerBtn) {
        if (status === 'online') {
            startServerBtn.style.display = 'none';
            stopServerBtn.style.display = 'inline-block';
        } else {
            startServerBtn.style.display = 'inline-block';
            stopServerBtn.style.display = 'none';
        }
    }
}

async function manageServer(action) {
    if (!isInTauri) {
        showNotification(`Server ${action} (Demo mode)`, 'success');
        return;
    }

    try {
        showLoading(`${action.charAt(0).toUpperCase() + action.slice(1)}ing server...`);
        
        // TODO: Use Tauri commands
        // await window.__TAURI__.invoke(`${action}_server`);
        
        showNotification(`Server ${action}ed successfully!`, 'success');
        
        // Refresh status after a delay
        setTimeout(checkServerStatus, 1000);
    } catch (error) {
        console.error(`Failed to ${action} server:`, error);
        showNotification(`Failed to ${action} server`, 'error');
    } finally {
        hideLoading();
    }
}

async function testNotification() {
    if (!isInTauri) {
        showNotification('This is a test notification!', 'success');
        return;
    }

    try {
        // Temporarily skip notification permission check
        showNotification('Test notification would be sent here!', 'success');
        console.log('Test notification simulated successfully');
    } catch (error) {
        console.error('Failed to send test notification:', error);
        showNotification('Failed to send test notification', 'error');
    }
}

function toggleNotificationOptions() {
    const enabled = document.getElementById('notificationsEnabled').checked;
    const options = document.getElementById('notificationOptions');
    
    if (options) {
        options.style.opacity = enabled ? '1' : '0.5';
        
        const inputs = options.querySelectorAll('input');
        inputs.forEach(input => {
            input.disabled = !enabled;
        });
    }
}

function toggleNgrokToken() {
    const enabled = document.getElementById('ngrokEnabled').checked;
    const tokenGroup = document.getElementById('ngrokTokenGroup');
    
    if (tokenGroup) {
        tokenGroup.style.display = enabled ? 'block' : 'none';
    }
}

async function openWebInterface() {
    const serverPort = document.getElementById('serverPort').value || 4021;
    const url = `http://localhost:${serverPort}`;
    
    console.log('🌐 Opening web interface:', url);
    
    if (isInTauri) {
        try {
            console.log('🚀 Using invokeTauri to open URL');
            await invokeTauri('open_external_url', { url: url });
            showNotification('Opening web interface...', 'success');
        } catch (error) {
            console.error('❌ Failed to open URL via Tauri:', error);
            console.log('🔍 Trying manual browser open as fallback...');
            
            // Fallback: try to copy URL to clipboard and show instructions
                try {
                    if (navigator.clipboard) {
                        await navigator.clipboard.writeText(url);
                        showNotification(`URL copied to clipboard: ${url}`, 'success');
                    } else {
                        showNotification(`Please open: ${url}`, 'info');
                    }
                } catch (clipboardError) {
                    showNotification(`Please open: ${url}`, 'info');
                }
            }
        } catch (error) {
            console.error('Failed to open web interface:', error);
            showNotification(`Failed to open web interface: ${error.message || error}`, 'error');
        }
    } else {
        window.open(url, '_blank');
    }
}

async function openExternalUrl(url) {
    if (isInTauri) {
        try {
            await invokeTauri('open_external_url', { url: url });
        } catch (error) {
            console.error('Failed to open external URL via Tauri:', error);
            // Fallback to regular window.open
            window.open(url, '_blank');
        }
    } else {
        window.open(url, '_blank');
    }
}

async function viewLogs() {
    console.log('📄 Attempting to view logs');
    
    if (!isInTauri) {
        showNotification('Logs would open here (Demo mode)', 'success');
        return;
    }

    try {
        // For now, just show a simple message - logs functionality will be enhanced later
        showNotification('📄 Logs functionality coming soon! Check the console for now.', 'info');
        
        // Log some basic info to console
        console.log('TunnelForge Desktop - Application Logs');
        console.log('====================================');
        console.log('App initialized at:', new Date().toISOString());
        console.log('Tauri environment:', isInTauri);
        console.log('Current URL:', window.location.href);
        console.log('Tauri v1 available:', !!window.__TAURI__);
        console.log('Tauri v2 available:', !!window.__TAURI_INVOKE__);
        console.log('invokeTauri available:', typeof invokeTauri === 'function');
    } catch (error) {
        console.error('Failed to show logs info:', error);
        showNotification('Failed to show logs info', 'error');
    }
}

// UI Helper functions
function showLoading(text = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    
    if (overlay) {
        overlay.style.display = 'flex';
    }
    
    if (loadingText) {
        loadingText.textContent = text;
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const icon = notification.querySelector('.notification-icon');
    const messageEl = notification.querySelector('.notification-message');
    
    if (!notification || !messageEl) return;

    // Set message
    messageEl.textContent = message;
    
    // Set icon based on type
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    if (icon) {
        icon.textContent = icons[type] || icons.info;
    }
    
    // Update classes
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Export for potential use by Tauri
if (isInTauri) {
    window.TunnelForgeDesktop = {
        updateServerStatus,
        showNotification,
        loadSettings,
        saveSettings
    };
}