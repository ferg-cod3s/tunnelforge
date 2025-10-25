// TunnelForge Desktop Settings - JavaScript
console.log('🔧 TunnelForge Desktop JavaScript loading...');

// Tauri v2 API Detection
let isInTauri = false;
let tauriInvoke = null;

// Check if we're in Tauri environment
const isTauriUserAgent = navigator.userAgent.includes('Tauri');
const isTauriProtocol = window.location.protocol === 'tauri:';
const isTauriOrigin = window.location.origin.startsWith('tauri://');

console.log('🔍 Checking Tauri environment...');
console.log('  - User Agent includes Tauri:', isTauriUserAgent);
console.log('  - Protocol:', window.location.protocol);
console.log('  - Origin:', window.location.origin);

// Helper function to invoke Tauri commands
async function invokeTauri(command, args = {}) {
    try {
        // Try v2 (core.invoke) first, then fallback to v1
        if (window.__TAURI__?.core?.invoke) {
            console.log(`🔧 Invoking Tauri v2 command: ${command}`, args);
            return await window.__TAURI__.core.invoke(command, args);
        } else if (window.__TAURI_INVOKE__) {
            console.log(`🔧 Invoking Tauri v1 command: ${command}`, args);
            return await window.__TAURI_INVOKE__(command, args);
        } else {
            throw new Error('Tauri API not available');
        }
    } catch (error) {
        console.error(`❌ Tauri command failed: ${command}`, error);
        throw error;
    }
}

// Initialize Tauri detection
async function initializeTauri() {
    const statusBanner = document.getElementById('tauriDetectionStatus');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    
    try {
        // Test Tauri availability
        if (window.__TAURI__ || window.__TAURI_INVOKE__) {
            isInTauri = true;
            tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI_INVOKE__;
            
            if (statusBanner) {
                statusBanner.textContent = '✅ Detected';
                statusBanner.style.background = '#4caf50';
            }
            
            console.log('✅ Tauri detected successfully');
            console.log('  - __TAURI__ available:', !!window.__TAURI__);
            console.log('  - __TAURI_INVOKE__ available:', !!window.__TAURI_INVOKE__);
            
            // Test basic functionality
            await testTauriFunctionality();
        } else {
            if (statusBanner) {
                statusBanner.textContent = '❌ Not Detected';
                statusBanner.style.background = '#f44336';
            }
            console.log('❌ Tauri not detected');
        }
    } catch (error) {
        console.error('❌ Error detecting Tauri:', error);
        if (statusBanner) {
            statusBanner.textContent = '❌ Error';
            statusBanner.style.background = '#f44336';
        }
    }
    
    // Update server status
    await updateServerStatus();

    // Start automatic status polling (every 5 seconds)
    setInterval(updateServerStatus, 5000);
}

// Test Tauri functionality
async function testTauriFunctionality() {
    try {
        const result = await invokeTauri('write_diagnostics', {
            timestamp: new Date().toISOString(),
            test_type: 'desktop_settings_ui',
            tauri_version: 'v2',
            interface: 'settings_page'
        });
        console.log('✅ Tauri functionality test passed:', result);
    } catch (error) {
        console.error('❌ Tauri functionality test failed:', error);
    }
}

// Update server status
async function updateServerStatus() {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const serverStatusText = document.getElementById('serverStatusText');
    const serverPID = document.getElementById('serverPID');
    
    try {
        const status = await invokeTauri('get_server_status');
        
        if (status && status.running) {
            if (statusIndicator) {
                statusIndicator.className = 'status-indicator online';
            }
            if (statusText) {
                statusText.textContent = 'Server Online';
            }
            if (serverStatusText) {
                serverStatusText.textContent = 'Running';
                serverStatusText.className = 'status-value online';
            }
            if (serverPID && status.pid) {
                serverPID.textContent = status.pid;
            }
        } else {
            if (statusIndicator) {
                statusIndicator.className = 'status-indicator offline';
            }
            if (statusText) {
                statusText.textContent = 'Server Offline';
            }
            if (serverStatusText) {
                serverStatusText.textContent = 'Stopped';
                serverStatusText.className = 'status-value offline';
            }
        }
    } catch (error) {
        console.error('❌ Failed to update server status:', error);
        if (statusIndicator) {
            statusIndicator.className = 'status-indicator unknown';
        }
        if (statusText) {
            statusText.textContent = 'Connection Error';
        }
        if (serverStatusText) {
            serverStatusText.textContent = 'Unable to connect';
            serverStatusText.className = 'status-value unknown';
        }
        if (serverPID) {
            serverPID.textContent = 'N/A';
        }
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const notificationMessage = document.querySelector('.notification-message');
    const notificationIcon = document.querySelector('.notification-icon');
    
    if (notification && notificationMessage) {
        notificationMessage.textContent = message;
        
        // Set icon based on type
        if (notificationIcon) {
            const icons = {
                success: '✅',
                error: '❌',
                info: 'ℹ️',
                warning: '⚠️'
            };
            notificationIcon.textContent = icons[type] || icons.info;
        }
        
        notification.style.display = 'flex';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.nav-link[data-tab]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = link.dataset.tab;
            switchTab(tabName);
        });
    });
    
    // Action buttons
    const openWebUI = document.getElementById('openWebUI');
    if (openWebUI) {
        openWebUI.addEventListener('click', () => {
            window.open('http://localhost:4021/', '_blank');
        });
    }
    
    const viewLogs = document.getElementById('viewLogs');
    if (viewLogs) {
        viewLogs.addEventListener('click', () => {
            window.open('http://localhost:4021/logs', '_blank');
        });
    }
    
    const testTauri = document.getElementById('testTauri');
    if (testTauri) {
        testTauri.addEventListener('click', async () => {
            try {
                await testTauriFunctionality();
                showNotification('Tauri functionality test completed successfully!', 'success');
            } catch (error) {
                showNotification('Tauri test failed: ' + error.message, 'error');
            }
        });
    }
    
    // Settings form
    const saveSettings = document.getElementById('saveSettings');
    if (saveSettings) {
        saveSettings.addEventListener('click', async () => {
            await saveSettingsData();
        });
    }
    
    // Server management
    const startServer = document.getElementById('startServer');
    if (startServer) {
        startServer.addEventListener('click', async () => {
            try {
                await invokeTauri('start_server');
                showNotification('Server started successfully', 'success');
                setTimeout(updateServerStatus, 2000); // Wait for start
            } catch (error) {
                showNotification('Failed to start server: ' + error.message, 'error');
            }
        });
    }

    const stopServer = document.getElementById('stopServer');
    if (stopServer) {
        stopServer.addEventListener('click', async () => {
            try {
                await invokeTauri('stop_server');
                showNotification('Server stopped successfully', 'success');
                await updateServerStatus();
            } catch (error) {
                showNotification('Failed to stop server: ' + error.message, 'error');
            }
        });
    }
    
    const restartServer = document.getElementById('restartServer');
    if (restartServer) {
        restartServer.addEventListener('click', async () => {
            try {
                await invokeTauri('restart_server');
                showNotification('Server restarted successfully', 'success');
                setTimeout(updateServerStatus, 2000); // Wait for restart
            } catch (error) {
                showNotification('Failed to restart server: ' + error.message, 'error');
            }
        });
    }
}

// Switch tabs
function switchTab(tabName) {
    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update panels
    document.querySelectorAll('.settings-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
}

// Save settings
async function saveSettingsData() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
    
    try {
        const settings = {
            autoStart: document.getElementById('autoStart')?.checked || false,
            showInDock: document.getElementById('showInDock')?.checked || false,
            serverPort: parseInt(document.getElementById('serverPort')?.value) || 4021,
            accessMode: document.getElementById('accessMode')?.value || 'localhost',
            notificationsEnabled: document.getElementById('notificationsEnabled')?.checked || false,
            notificationSound: document.getElementById('notificationSound')?.checked || false,
            sessionStartNotification: document.getElementById('sessionStartNotification')?.checked || false,
            sessionEndNotification: document.getElementById('sessionEndNotification')?.checked || false,
            errorNotification: document.getElementById('errorNotification')?.checked || false,
            preventSleep: document.getElementById('preventSleep')?.checked || false,
            powerMonitoring: document.getElementById('powerMonitoring')?.checked || false,
            tailscaleEnabled: document.getElementById('tailscaleEnabled')?.checked || false,
            cloudflareEnabled: document.getElementById('cloudflareEnabled')?.checked || false,
            ngrokEnabled: document.getElementById('ngrokEnabled')?.checked || false,
            ngrokAuthToken: document.getElementById('ngrokAuthToken')?.value || ''
        };
        
        await invokeTauri('save_settings', settings);
        showNotification('Settings saved successfully!', 'success');
    } catch (error) {
        showNotification('Failed to save settings: ' + error.message, 'error');
    } finally {
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 TunnelForge Desktop UI loaded');
    
    // Initialize Tauri
    initializeTauri();
    
    // Setup event listeners
    setupEventListeners();
    
    // Set up periodic status updates
    setInterval(updateServerStatus, 5000);
    
    console.log('✅ TunnelForge Desktop initialized successfully');
});