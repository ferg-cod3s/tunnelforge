use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StoredCredential {
    pub service: String,
    pub account: String,
}

#[tauri::command]
pub async fn store_credential(
    service: String,
    account: String,
    password: String,
) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        
        let input = format!("{}", password);
        let mut child = Command::new("secret-tool")
            .args([
                "store",
                "--label",
                &format!("TunnelForge - {}", service),
                "service",
                &service,
                "account",
                &account,
            ])
            .stdin(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to launch secret-tool: {}", e))?;
        
        if let Some(mut stdin) = child.stdin.take() {
            use std::io::Write;
            stdin
                .write_all(input.as_bytes())
                .map_err(|e| format!("Failed to write password: {}", e))?;
        }
        
        let status = child.wait().map_err(|e| format!("Failed to wait for secret-tool: {}", e))?;
        
        if status.success() {
            Ok(())
        } else {
            Err("Failed to store credential".to_string())
        }
    }
    
    #[cfg(not(target_os = "linux"))]
    {
        Err("Keyring is only supported on Linux".to_string())
    }
}

#[tauri::command]
pub async fn get_credential(service: String, account: String) -> Result<String, String> {
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        
        let output = Command::new("secret-tool")
            .args([
                "lookup",
                "service",
                &service,
                "account",
                &account,
            ])
            .output()
            .map_err(|e| format!("Failed to launch secret-tool: {}", e))?;
        
        if output.status.success() {
            let password = String::from_utf8_lossy(&output.stdout)
                .trim()
                .to_string();
            Ok(password)
        } else {
            Err("Credential not found".to_string())
        }
    }
    
    #[cfg(not(target_os = "linux"))]
    {
        Err("Keyring is only supported on Linux".to_string())
    }
}

#[tauri::command]
pub async fn delete_credential(service: String, account: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        
        let output = Command::new("secret-tool")
            .args([
                "clear",
                "service",
                &service,
                "account",
                &account,
            ])
            .output()
            .map_err(|e| format!("Failed to launch secret-tool: {}", e))?;
        
        if output.status.success() {
            Ok(())
        } else {
            Err("Failed to delete credential".to_string())
        }
    }
    
    #[cfg(not(target_os = "linux"))]
    {
        Err("Keyring is only supported on Linux".to_string())
    }
}

#[tauri::command]
pub async fn list_credentials() -> Result<Vec<StoredCredential>, String> {
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        
        let output = Command::new("secret-tool")
            .args(["search", "--all", "service", "tunnelforge"])
            .output()
            .map_err(|e| format!("Failed to launch secret-tool: {}", e))?;
        
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let credentials = parse_secret_tool_output(&stdout);
            Ok(credentials)
        } else {
            Ok(vec![])
        }
    }
    
    #[cfg(not(target_os = "linux"))]
    {
        Err("Keyring is only supported on Linux".to_string())
    }
}

#[cfg(target_os = "linux")]
fn parse_secret_tool_output(output: &str) -> Vec<StoredCredential> {
    let mut credentials = Vec::new();
    let mut current_service = None;
    let mut current_account = None;
    
    for line in output.lines() {
        if line.starts_with("attribute.service = ") {
            current_service = Some(line.trim_start_matches("attribute.service = ").to_string());
        } else if line.starts_with("attribute.account = ") {
            current_account = Some(line.trim_start_matches("attribute.account = ").to_string());
        } else if line.starts_with("secret = ") {
            if let (Some(service), Some(account)) = (current_service.take(), current_account.take()) {
                credentials.push(StoredCredential { service, account });
            }
        }
    }
    
    credentials
}

#[tauri::command]
pub async fn is_keyring_available() -> Result<bool, String> {
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        
        let output = Command::new("which")
            .arg("secret-tool")
            .output()
            .map_err(|e| format!("Failed to check for secret-tool: {}", e))?;
        
        Ok(output.status.success())
    }
    
    #[cfg(not(target_os = "linux"))]
    {
        Ok(false)
    }
}
