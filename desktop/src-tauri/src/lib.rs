use anyhow::Result;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::RwLock;

mod security;
use security::SecurityManager;

pub struct AppState {
    security_manager: Arc<SecurityManager>,
    // Other state fields...
}

impl AppState {
    pub async fn new() -> Result<Self> {
        let security_manager = Arc::new(SecurityManager::new()?);
        
        // Initialize security manager with initial key
        security_manager.rotate_keys().await?;
        
        Ok(Self {
            security_manager,
            // Initialize other state...
        })
    }
}

#[tauri::command]
async fn secure_store(
    app_handle: tauri::AppHandle,
    key: String,
    value: String,
) -> Result<(), String> {
    let state = app_handle.state::<Arc<RwLock<AppState>>>();
    let state = state.read().await;
    
    let encrypted = state
        .security_manager
        .encrypt(value.as_bytes())
        .await
        .map_err(|e| e.to_string())?;
    
    // Store encrypted data...
    
    Ok(())
}

#[tauri::command]
async fn secure_retrieve(
    app_handle: tauri::AppHandle,
    key: String,
) -> Result<String, String> {
    let state = app_handle.state::<Arc<RwLock<AppState>>>();
    let state = state.read().await;
    
    // Retrieve encrypted data...
    let encrypted_data = vec![]; // Placeholder
    
    let decrypted = state
        .security_manager
        .decrypt(&encrypted_data)
        .await
        .map_err(|e| e.to_string())?;
    
    String::from_utf8(decrypted).map_err(|e| e.to_string())
}

pub fn init_app() -> Result<()> {
    tauri::Builder::default()
        .manage(Arc::new(RwLock::new(AppState::new().await?)))
        .invoke_handler(tauri::generate_handler![
            secure_store,
            secure_retrieve,
        ])
        .setup(|app| {
            // Setup secure window configuration
            let main_window = app.get_window("main").unwrap();
            main_window.set_title("TunnelForge").unwrap();
            
            #[cfg(debug_assertions)]
            main_window.open_devtools();
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    Ok(())
}
