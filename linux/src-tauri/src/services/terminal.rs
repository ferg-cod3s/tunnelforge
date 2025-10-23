use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TerminalInfo {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TerminalPreferences {
    pub preferred_terminal: Option<String>,
    pub shell: String,
    pub custom_shell_args: Vec<String>,
}

impl Default for TerminalPreferences {
    fn default() -> Self {
        Self {
            preferred_terminal: None,
            shell: String::from("/bin/bash"),
            custom_shell_args: vec![],
        }
    }
}

#[tauri::command]
pub async fn detect_available_terminals() -> Result<Vec<TerminalInfo>, String> {
    let terminals = vec![
        TerminalInfo {
            name: "GNOME Terminal".to_string(),
            command: "gnome-terminal".to_string(),
            args: vec!["--".to_string()],
        },
        TerminalInfo {
            name: "Konsole".to_string(),
            command: "konsole".to_string(),
            args: vec!["-e".to_string()],
        },
        TerminalInfo {
            name: "XFCE Terminal".to_string(),
            command: "xfce4-terminal".to_string(),
            args: vec!["-e".to_string()],
        },
        TerminalInfo {
            name: "Alacritty".to_string(),
            command: "alacritty".to_string(),
            args: vec!["-e".to_string()],
        },
        TerminalInfo {
            name: "Kitty".to_string(),
            command: "kitty".to_string(),
            args: vec![],
        },
        TerminalInfo {
            name: "Terminator".to_string(),
            command: "terminator".to_string(),
            args: vec!["-e".to_string()],
        },
        TerminalInfo {
            name: "Tilix".to_string(),
            command: "tilix".to_string(),
            args: vec!["-e".to_string()],
        },
        TerminalInfo {
            name: "xterm".to_string(),
            command: "xterm".to_string(),
            args: vec!["-e".to_string()],
        },
    ];
    
    let mut available = Vec::new();
    
    for terminal in terminals {
        if is_command_available(&terminal.command) {
            available.push(terminal);
        }
    }
    
    Ok(available)
}

#[tauri::command]
pub async fn get_terminal_preferences() -> Result<TerminalPreferences, String> {
    Ok(TerminalPreferences::default())
}

#[tauri::command]
pub async fn update_terminal_preferences(preferences: TerminalPreferences) -> Result<(), String> {
    log::info!("Updating terminal preferences: {:?}", preferences);
    Ok(())
}

#[tauri::command]
pub async fn launch_terminal(directory: Option<String>) -> Result<(), String> {
    let terminals = detect_available_terminals().await?;
    
    if terminals.is_empty() {
        return Err("No terminal emulator found".to_string());
    }
    
    let terminal = &terminals[0];
    let mut cmd = Command::new(&terminal.command);
    
    if let Some(dir) = directory {
        cmd.current_dir(&dir);
    }
    
    cmd.args(&terminal.args);
    
    cmd.spawn()
        .map_err(|e| format!("Failed to launch terminal: {}", e))?;
    
    log::info!("Launched terminal: {}", terminal.name);
    Ok(())
}

#[tauri::command]
pub async fn get_default_shell() -> Result<String, String> {
    std::env::var("SHELL")
        .unwrap_or_else(|_| String::from("/bin/bash"))
        .split('/')
        .last()
        .map(|s| s.to_string())
        .ok_or_else(|| "Failed to determine shell".to_string())
}

#[tauri::command]
pub async fn detect_desktop_environment() -> Result<String, String> {
    if let Ok(de) = std::env::var("XDG_CURRENT_DESKTOP") {
        return Ok(de);
    }
    
    if let Ok(de) = std::env::var("DESKTOP_SESSION") {
        return Ok(de);
    }
    
    if is_command_available("gnome-shell") {
        return Ok("GNOME".to_string());
    }
    
    if is_command_available("kwin_x11") || is_command_available("kwin_wayland") {
        return Ok("KDE".to_string());
    }
    
    if is_command_available("xfce4-session") {
        return Ok("XFCE".to_string());
    }
    
    Ok("Unknown".to_string())
}

fn is_command_available(command: &str) -> bool {
    Command::new("which")
        .arg(command)
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}
