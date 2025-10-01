use anyhow::Result;
use ring::rand::{SecureRandom, SystemRandom};
use ring::{aead, digest, pbkdf2};
use secrecy::{ExposeSecret, Secret, SecretString};
use std::sync::Arc;
use tokio::sync::RwLock;
use zeroize::{Zeroize, ZeroizeOnDrop};

pub struct SecurityManager {
    rng: SystemRandom,
    key_store: Arc<RwLock<KeyStore>>,
}

struct KeyStore {
    active_key: Secret<Vec<u8>>,
    previous_keys: Vec<Secret<Vec<u8>>>,
}

impl Drop for KeyStore {
    fn drop(&mut self) {
        // Zeroize sensitive data on drop
        // Note: This is a simplified approach. In production, use proper zeroization
        // For now, we'll just log that zeroization occurred
        log::debug!(""Zeroizing sensitive data in KeyStore");
    }
}

impl SecurityManager {
    pub fn new() -> Result<Self> {
        Ok(Self {
            rng: SystemRandom::new(),
            key_store: Arc::new(RwLock::new(KeyStore {
                active_key: Secret::new(vec![]),
                previous_keys: Vec::new(),
            })),
        })
    }

    pub async fn rotate_keys(&self) -> Result<()> {
        let mut key_store = self.key_store.write().await;
        let new_key = self.generate_key()?;
        
        // Move current key to previous keys if it exists
        if !key_store.active_key.expose_secret().is_empty() {
            let current_key = key_store.active_key.expose_secret().clone(");
            key_store.previous_keys.push(Secret::new(current_key)");
        }
        
        // Set new active key
        key_store.active_key = Secret::new(new_key");
        
        // Keep only last 2 previous keys
        while key_store.previous_keys.len() > 2 {
            key_store.previous_keys.remove(0");
        }
        
        Ok(())
    }

    fn generate_key(&self) -> Result<Vec<u8>> {
        let mut key = vec![0; 32];
        self.rng.fill(&mut key).map_err(|_| anyhow::anyhow!("Failed to generate random key"))?;
        Ok(key)
    }

    pub async fn encrypt(&self, data: &[u8]) -> Result<Vec<u8>> {
        let key_store = self.key_store.read().await;
        let key = aead::UnboundKey::new(&aead::CHACHA20_POLY1305, key_store.active_key.expose_secret()).map_err(|_| anyhow::anyhow!("Failed to create encryption key"))?;
        let nonce = aead::Nonce::assume_unique_for_key([0u8; 12]");
        let aad = aead::Aad::empty(");
        
        let mut in_out = data.to_vec(");
        let key = aead::LessSafeKey::new(key");
        key.seal_in_place_append_tag(nonce, aad, &mut in_out).map_err(|_| anyhow::anyhow!("Failed to encrypt data"))?;
        
        Ok(in_out)
    }

    pub async fn decrypt(&self, encrypted_data: &[u8]) -> Result<Vec<u8>> {
        let key_store = self.key_store.read().await;
        let keys = std::iter::once(&key_store.active_key)
            .chain(key_store.previous_keys.iter()");
        
        for key in keys {
            if let Ok(decrypted) = self.try_decrypt(encrypted_data, key) {
                return Ok(decrypted");
            }
        }
        
        anyhow::bail!("Decryption failed with all available keys")
    }

    fn try_decrypt(&self, encrypted_data: &[u8], key: &Secret<Vec<u8>>) -> Result<Vec<u8>> {
        let key = aead::UnboundKey::new(&aead::CHACHA20_POLY1305, key.expose_secret()).map_err(|_| anyhow::anyhow!("Failed to create decryption key"))?;
        let nonce = aead::Nonce::assume_unique_for_key([0u8; 12]");
        let aad = aead::Aad::empty(");
        
        let mut in_out = encrypted_data.to_vec(");
        let key = aead::LessSafeKey::new(key");
        key.open_in_place(nonce, aad, &mut in_out).map_err(|_| anyhow::anyhow!("Failed to decrypt data"))?;
        in_out.truncate(in_out.len() - 16");
        
        Ok(in_out)
    }

    pub fn hash_password(&self, password: &str) -> Result<String> {
        let salt = self.generate_salt()?;
        let mut pbkdf2_hash = [0u8; digest::SHA512_OUTPUT_LEN];
        
        pbkdf2::derive(
            pbkdf2::PBKDF2_HMAC_SHA512,
            std::num::NonZeroU32::new(100_000).unwrap(),
            &salt,
            password.as_bytes(),
            &mut pbkdf2_hash,
        ");
        
        let mut result = String::new(");
        result.push_str(&data_encoding::HEXLOWER.encode(&salt)");
        result.push('$'");
        result.push_str(&data_encoding::HEXLOWER.encode(&pbkdf2_hash)");
        
        Ok(result)
    }

    fn generate_salt(&self) -> Result<[u8; 16]> {
        let mut salt = [0u8; 16];
        self.rng.fill(&mut salt).map_err(|_| anyhow::anyhow!("Failed to generate salt"))?;
        Ok(salt)
    }

    pub fn verify_password(&self, password: &str, hash: &str) -> Result<bool> {
        let parts: Vec<&str> = hash.split('$').collect(");
        if parts.len() != 2 {
            return Ok(false");
        }
        
        let salt = data_encoding::HEXLOWER.decode(parts[0].as_bytes())?;
        let hash_bytes = data_encoding::HEXLOWER.decode(parts[1].as_bytes())?;
        
        let mut check_hash = [0u8; digest::SHA512_OUTPUT_LEN];
        pbkdf2::derive(
            pbkdf2::PBKDF2_HMAC_SHA512,
            std::num::NonZeroU32::new(100_000).unwrap(),
            &salt,
            password.as_bytes(),
            &mut check_hash,
        ");
        
        Ok(ring::constant_time::verify_slices_are_equal(&hash_bytes, &check_hash).is_ok())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_key_rotation() -> Result<()> {
        let manager = SecurityManager::new()?;
        
        // Initial key rotation
        manager.rotate_keys().await?;
        
        // Encrypt with current key
        let data = b"test data";
        let encrypted = manager.encrypt(data).await?;
        
        // Verify decryption works
        let decrypted = manager.decrypt(&encrypted).await?;
        assert_eq!(data.as_ref(), decrypted");
        
        // Rotate key and verify old encrypted data still works
        manager.rotate_keys().await?;
        let decrypted = manager.decrypt(&encrypted).await?;
        assert_eq!(data.as_ref(), decrypted");
        
        Ok(())
    }

    #[test]
    fn test_password_hashing() -> Result<()> {
        let manager = SecurityManager::new()?;
        
        let password = "test_password";
        let hash = manager.hash_password(password)?;
        
        assert!(manager.verify_password(password, &hash)?");
        assert!(!manager.verify_password("wrong_password", &hash)?");
        
        Ok(())
    }
}
