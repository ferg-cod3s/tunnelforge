//! Enterprise authentication module for TunnelForge
//! Provides LDAP/AD integration and SSO support

use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};

mod ldap;
mod sso;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnterpriseAuthConfig {
    /// LDAP configuration
    pub ldap: Option<ldap::LdapConfig>,
    /// SSO configuration 
    pub sso: Option<sso::SsoConfig>,
}

pub struct EnterpriseAuth {
    config: Arc<RwLock<EnterpriseAuthConfig>>,
}

impl EnterpriseAuth {
    pub fn new(config: EnterpriseAuthConfig) -> Self {
        Self {
            config: Arc::new(RwLock::new(config)),
        }
    }

    pub async fn authenticate(&self, credentials: AuthCredentials) -> Result<AuthToken, AuthError> {
        // Try LDAP first if configured
        if let Some(ldap_config) = &self.config.read().await.ldap {
            match self.authenticate_ldap(credentials.clone(), ldap_config).await {
                Ok(token) => return Ok(token),
                Err(_) => {} // Fall through to SSO
            }
        }

        // Try SSO if configured
        if let Some(sso_config) = &self.config.read().await.sso {
            return self.authenticate_sso(credentials, sso_config).await;
        }

        Err(AuthError::NoAuthMethodsConfigured)
    }

    async fn authenticate_ldap(
        &self,
        credentials: AuthCredentials,
        config: &ldap::LdapConfig,
    ) -> Result<AuthToken, AuthError> {
        ldap::authenticate(credentials, config).await
    }

    async fn authenticate_sso(
        &self,
        credentials: AuthCredentials,
        config: &sso::SsoConfig,
    ) -> Result<AuthToken, AuthError> {
        sso::authenticate(credentials, config).await
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthCredentials {
    pub username: String,
    pub password: Option<String>,
    pub token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthToken {
    pub token: String,
    pub expires_at: chrono::DateTime<chrono::Utc>,
    pub claims: AuthClaims,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthClaims {
    pub sub: String,
    pub name: String,
    pub email: String,
    pub groups: Vec<String>,
    pub permissions: Vec<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("No authentication methods configured")]
    NoAuthMethodsConfigured,
    
    #[error("LDAP error: {0}")]
    LdapError(String),
    
    #[error("SSO error: {0}")]
    SsoError(String),
    
    #[error("Invalid credentials")]
    InvalidCredentials,
    
    #[error("Token expired")]
    TokenExpired,
}
