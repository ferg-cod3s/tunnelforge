//! Platform-specific tests for TunnelForge
//! 
//! Tests platform-specific functionality including:
//! - Windows Services and Registry
//! - macOS Launch Agents and Frameworks
//! - Linux systemd and Package Managers

use anyhow::Result;

mod windows_tests;
mod macos_tests;
mod linux_tests;
mod platform_utils;

pub async fn run_platform_tests() -> Result<()> {
    println!("Running platform-specific tests...");
    
    #[cfg(target_os = "windows")]
    {
        windows_tests::run_windows_tests().await?;
    }
    
    #[cfg(target_os = "macos")]
    {
        macos_tests::run_macos_tests().await?;
    }
    
    #[cfg(target_os = "linux")]
    {
        linux_tests::run_linux_tests().await?;
    }
    
    // Run common platform tests
    platform_utils::run_common_tests().await?;
    
    Ok(())
}

#[tokio::test]
async fn test_platform_functionality() -> Result<()> {
    run_platform_tests().await
}