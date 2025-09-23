package config

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
)

// SecureConfigManager manages encrypted configuration storage
type SecureConfigManager struct {
	configDir    string
	encryptionKey []byte
	mu           sync.RWMutex
}

// NewSecureConfigManager creates a new secure config manager
func NewSecureConfigManager(configDir string) (*SecureConfigManager, error) {
	manager := &SecureConfigManager{
		configDir: configDir,
	}
	
	// Generate or load encryption key
	if err := manager.initEncryptionKey(); err != nil {
		return nil, fmt.Errorf("failed to initialize encryption key: %w", err)
	}
	
	// Ensure config directory exists
	if err := os.MkdirAll(configDir, 0700); err != nil {
		return nil, fmt.Errorf("failed to create config directory: %w", err)
	}
	
	return manager, nil
}

// initEncryptionKey initializes the encryption key
func (scm *SecureConfigManager) initEncryptionKey() error {
	keyPath := filepath.Join(scm.configDir, "encryption.key")
	
	// Check if key already exists
	if _, err := os.Stat(keyPath); err == nil {
		// Load existing key
		keyData, err := os.ReadFile(keyPath)
		if err != nil {
			return fmt.Errorf("failed to read encryption key: %w", err)
		}
		scm.encryptionKey = make([]byte, base64.StdEncoding.DecodedLen(len(keyData)))
		n, err := base64.StdEncoding.Decode(scm.encryptionKey, keyData)
		if err != nil {
			return fmt.Errorf("failed to decode encryption key: %w", err)
		}
		scm.encryptionKey = scm.encryptionKey[:n]
	} else {
		// Generate new key
		scm.encryptionKey = make([]byte, 32) // 256-bit key
		if _, err := io.ReadFull(rand.Reader, scm.encryptionKey); err != nil {
			return fmt.Errorf("failed to generate encryption key: %w", err)
		}
		
		// Save key
		encodedKey := base64.StdEncoding.EncodeToString(scm.encryptionKey)
		if err := os.WriteFile(keyPath, []byte(encodedKey), 0600); err != nil {
			return fmt.Errorf("failed to save encryption key: %w", err)
		}
	}
	
	return nil
}

// StoreSecureValue stores an encrypted value
func (scm *SecureConfigManager) StoreSecureValue(key, value string) error {
	scm.mu.Lock()
	defer scm.mu.Unlock()
	
	if value == "" {
		return scm.deleteSecureValue(key)
	}
	
	encryptedValue, err := scm.encrypt(value)
	if err != nil {
		return fmt.Errorf("failed to encrypt value: %w", err)
	}
	
	valuePath := filepath.Join(scm.configDir, key+".enc")
	if err := os.WriteFile(valuePath, []byte(encryptedValue), 0600); err != nil {
		return fmt.Errorf("failed to store encrypted value: %w", err)
	}
	
	return nil
}

// GetSecureValue retrieves a decrypted value
func (scm *SecureConfigManager) GetSecureValue(key string) (string, error) {
	scm.mu.RLock()
	defer scm.mu.RUnlock()
	
	valuePath := filepath.Join(scm.configDir, key+".enc")
	
	encryptedValue, err := os.ReadFile(valuePath)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil // Value not found
		}
		return "", fmt.Errorf("failed to read encrypted value: %w", err)
	}
	
	decryptedValue, err := scm.decrypt(string(encryptedValue))
	if err != nil {
		return "", fmt.Errorf("failed to decrypt value: %w", err)
	}
	
	return decryptedValue, nil
}

// DeleteSecureValue deletes an encrypted value
func (scm *SecureConfigManager) DeleteSecureValue(key string) error {
	scm.mu.Lock()
	defer scm.mu.Unlock()
	
	return scm.deleteSecureValue(key)
}

// deleteSecureValue deletes an encrypted value (internal method)
func (scm *SecureConfigManager) deleteSecureValue(key string) error {
	valuePath := filepath.Join(scm.configDir, key+".enc")
	
	if err := os.Remove(valuePath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete encrypted value: %w", err)
	}
	
	return nil
}

// encrypt encrypts a value using AES-GCM
func (scm *SecureConfigManager) encrypt(plaintext string) (string, error) {
	block, err := aes.NewCipher(scm.encryptionKey)
	if err != nil {
		return "", err
	}
	
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// decrypt decrypts a value using AES-GCM
func (scm *SecureConfigManager) decrypt(encryptedText string) (string, error) {
	ciphertext, err := base64.StdEncoding.DecodeString(encryptedText)
	if err != nil {
		return "", err
	}
	
	block, err := aes.NewCipher(scm.encryptionKey)
	if err != nil {
		return "", err
	}
	
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	
	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}
	
	nonce := ciphertext[:nonceSize]
	ciphertext = ciphertext[nonceSize:]
	
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	
	return string(plaintext), nil
}

// CloudflareCredentials represents Cloudflare API credentials
type CloudflareCredentials struct {
	APIToken  string `json:"api_token"`
	AccountID string `json:"account_id"`
}

// StoreCloudflareCredentials stores encrypted Cloudflare credentials
func (scm *SecureConfigManager) StoreCloudflareCredentials(credentials CloudflareCredentials) error {
	// Store API token
	if err := scm.StoreSecureValue("cloudflare_api_token", credentials.APIToken); err != nil {
		return fmt.Errorf("failed to store API token: %w", err)
	}
	
	// Store account ID
	if err := scm.StoreSecureValue("cloudflare_account_id", credentials.AccountID); err != nil {
		// Clean up API token if account ID storage fails
		scm.DeleteSecureValue("cloudflare_api_token")
		return fmt.Errorf("failed to store account ID: %w", err)
	}
	
	return nil
}

// GetCloudflareCredentials retrieves decrypted Cloudflare credentials
func (scm *SecureConfigManager) GetCloudflareCredentials() (CloudflareCredentials, error) {
	apiToken, err := scm.GetSecureValue("cloudflare_api_token")
	if err != nil {
		return CloudflareCredentials{}, fmt.Errorf("failed to get API token: %w", err)
	}
	
	accountID, err := scm.GetSecureValue("cloudflare_account_id")
	if err != nil {
		return CloudflareCredentials{}, fmt.Errorf("failed to get account ID: %w", err)
	}
	
	return CloudflareCredentials{
		APIToken:  apiToken,
		AccountID: accountID,
	}, nil
}

// DeleteCloudflareCredentials deletes stored Cloudflare credentials
func (scm *SecureConfigManager) DeleteCloudflareCredentials() error {
	if err := scm.DeleteSecureValue("cloudflare_api_token"); err != nil {
		return fmt.Errorf("failed to delete API token: %w", err)
	}
	
	if err := scm.DeleteSecureValue("cloudflare_account_id"); err != nil {
		return fmt.Errorf("failed to delete account ID: %w", err)
	}
	
	return nil
}

// HasCloudflareCredentials checks if Cloudflare credentials are stored
func (scm *SecureConfigManager) HasCloudflareCredentials() bool {
	apiToken, _ := scm.GetSecureValue("cloudflare_api_token")
	accountID, _ := scm.GetSecureValue("cloudflare_account_id")
	
	return apiToken != "" && accountID != ""
}
