package filesystem

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"unicode/utf8"

	"github.com/getsentry/sentry-go"
)

// FilePreview represents file preview metadata
type FilePreview struct {
	Type      string `json:"type"` // "image", "text", or "binary"
	Content   string `json:"content,omitempty"`
	Language  string `json:"language,omitempty"`
	URL       string `json:"url,omitempty"`
	MimeType  string `json:"mimeType,omitempty"`
	Size      int64  `json:"size"`
	HumanSize string `json:"humanSize,omitempty"`
}

// FileDiff represents git diff information
type FileDiff struct {
	Path    string `json:"path"`
	Diff    string `json:"diff"`
	HasDiff bool   `json:"hasDiff"`
}

// FileDiffContent represents file content for diff viewing
type FileDiffContent struct {
	Path             string `json:"path"`
	OriginalContent  string `json:"originalContent"`
	ModifiedContent  string `json:"modifiedContent"`
	Language         string `json:"language,omitempty"`
}

// formatSize converts bytes to human-readable format
func formatSize(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

// detectLanguage attempts to determine the programming language from file extension
func detectLanguage(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	languageMap := map[string]string{
		".go":         "go",
		".js":         "javascript",
		".ts":         "typescript",
		".jsx":        "javascript",
		".tsx":        "typescript",
		".py":         "python",
		".rb":         "ruby",
		".java":       "java",
		".c":          "c",
		".cpp":        "cpp",
		".cc":         "cpp",
		".h":          "c",
		".hpp":        "cpp",
		".cs":         "csharp",
		".php":        "php",
		".swift":      "swift",
		".rs":         "rust",
		".kt":         "kotlin",
		".sh":         "bash",
		".bash":       "bash",
		".zsh":        "bash",
		".fish":       "fish",
		".ps1":        "powershell",
		".r":          "r",
		".sql":        "sql",
		".html":       "html",
		".htm":        "html",
		".xml":        "xml",
		".css":        "css",
		".scss":       "scss",
		".sass":       "sass",
		".less":       "less",
		".json":       "json",
		".yaml":       "yaml",
		".yml":        "yaml",
		".toml":       "toml",
		".md":         "markdown",
		".markdown":   "markdown",
		".txt":        "plaintext",
		".log":        "plaintext",
		".conf":       "plaintext",
		".config":     "plaintext",
		".ini":        "ini",
		".dockerfile": "dockerfile",
		".gitignore":  "plaintext",
		".env":        "plaintext",
	}

	if lang, ok := languageMap[ext]; ok {
		return lang
	}

	// Check for Dockerfile without extension
	if strings.HasPrefix(strings.ToLower(filepath.Base(filename)), "dockerfile") {
		return "dockerfile"
	}

	return "plaintext"
}

// isTextFile checks if content is valid UTF-8 text
func isTextFile(content []byte) bool {
	// Check if valid UTF-8
	if !utf8.Valid(content) {
		return false
	}

	// Check for null bytes (binary indicator)
	for _, b := range content {
		if b == 0 {
			return false
		}
	}

	return true
}

// PreviewFile handles GET /api/fs/preview
func (fs *FileSystemService) PreviewFile(w http.ResponseWriter, r *http.Request) {
	log.Printf("👁️ PreviewFile request: %s %s", r.Method, r.URL.String())

	path := r.URL.Query().Get("path")
	if path == "" {
		log.Printf("❌ PreviewFile: Path parameter is required")
		http.Error(w, "Path parameter is required", http.StatusBadRequest)
		return
	}

	// Validate and resolve path
	fullPath, err := fs.validatePath(path)
	if err != nil {
		log.Printf("❌ PreviewFile path validation failed for %s: %v", path, err)
		userFriendlyError := getUserFriendlyError(err)
		http.Error(w, userFriendlyError, http.StatusBadRequest)
		return
	}

	// Check if file exists
	info, err := os.Stat(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			log.Printf("❌ PreviewFile: File not found: %s", fullPath)
			http.Error(w, "File not found", http.StatusNotFound)
		} else {
			log.Printf("❌ PreviewFile access denied for %s: %v", fullPath, err)
			http.Error(w, "Access denied", http.StatusForbidden)
		}
		return
	}

	// Ensure it's a file, not a directory
	if info.IsDir() {
		log.Printf("❌ PreviewFile: Cannot preview directory: %s", fullPath)
		http.Error(w, "Cannot preview directory", http.StatusBadRequest)
		return
	}

	// Determine MIME type
	mimeType := mime.TypeByExtension(filepath.Ext(fullPath))
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	preview := FilePreview{
		Size:      info.Size(),
		HumanSize: formatSize(info.Size()),
		MimeType:  mimeType,
	}

	// Check if it's an image
	if strings.HasPrefix(mimeType, "image/") {
		preview.Type = "image"
		preview.URL = fmt.Sprintf("/api/filesystem/download/%s", path)
		log.Printf("✅ PreviewFile: Image file %s", fullPath)
	} else {
		// Try to read as text (limit to 1MB for preview)
		maxPreviewSize := int64(1024 * 1024) // 1MB
		if info.Size() > maxPreviewSize {
			preview.Type = "binary"
			log.Printf("⚠️ PreviewFile: File too large for text preview: %s (%d bytes)", fullPath, info.Size())
		} else {
			// Read file content
			file, err := os.Open(fullPath)
			if err != nil {
				log.Printf("❌ PreviewFile failed to open file %s: %v", fullPath, err)
				sentry.WithScope(func(scope *sentry.Scope) {
					scope.SetTag("operation", "preview_file")
					scope.SetContext("file_info", map[string]interface{}{
						"path": path,
						"full_path": fullPath,
					})
					sentry.CaptureException(err)
				})
				http.Error(w, "Failed to read file", http.StatusInternalServerError)
				return
			}
			defer file.Close()

			content, err := io.ReadAll(file)
			if err != nil {
				log.Printf("❌ PreviewFile failed to read file %s: %v", fullPath, err)
				http.Error(w, "Failed to read file", http.StatusInternalServerError)
				return
			}

			// Check if it's text or binary
			if isTextFile(content) {
				preview.Type = "text"
				preview.Content = string(content)
				preview.Language = detectLanguage(fullPath)
				log.Printf("✅ PreviewFile: Text file %s (language: %s)", fullPath, preview.Language)
			} else {
				preview.Type = "binary"
				log.Printf("✅ PreviewFile: Binary file %s", fullPath)
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(preview)
}

// DiffFile handles GET /api/fs/diff - returns git diff for a file
func (fs *FileSystemService) DiffFile(w http.ResponseWriter, r *http.Request) {
	log.Printf("🔄 DiffFile request: %s %s", r.Method, r.URL.String())

	path := r.URL.Query().Get("path")
	if path == "" {
		log.Printf("❌ DiffFile: Path parameter is required")
		http.Error(w, "Path parameter is required", http.StatusBadRequest)
		return
	}

	// Validate and resolve path
	fullPath, err := fs.validatePath(path)
	if err != nil {
		log.Printf("❌ DiffFile path validation failed for %s: %v", path, err)
		userFriendlyError := getUserFriendlyError(err)
		http.Error(w, userFriendlyError, http.StatusBadRequest)
		return
	}

	// Check if file exists
	info, err := os.Stat(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			log.Printf("❌ DiffFile: File not found: %s", fullPath)
			http.Error(w, "File not found", http.StatusNotFound)
		} else {
			log.Printf("❌ DiffFile access denied for %s: %v", fullPath, err)
			http.Error(w, "Access denied", http.StatusForbidden)
		}
		return
	}

	// Ensure it's a file, not a directory
	if info.IsDir() {
		log.Printf("❌ DiffFile: Cannot diff directory: %s", fullPath)
		http.Error(w, "Cannot diff directory", http.StatusBadRequest)
		return
	}

	// Get git diff for the file
	// This is a simplified implementation - in production you'd use a git library
	diffResponse := FileDiff{
		Path:    path,
		HasDiff: false,
		Diff:    "",
	}

	// TODO: Integrate with git service to get actual diff
	// For now, return empty diff indicating no git integration
	log.Printf("✅ DiffFile: No git diff available for %s (git integration pending)", fullPath)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(diffResponse)
}

// DiffContent handles GET /api/fs/diff-content - returns original and modified content
func (fs *FileSystemService) DiffContent(w http.ResponseWriter, r *http.Request) {
	log.Printf("📄 DiffContent request: %s %s", r.Method, r.URL.String())

	path := r.URL.Query().Get("path")
	if path == "" {
		log.Printf("❌ DiffContent: Path parameter is required")
		http.Error(w, "Path parameter is required", http.StatusBadRequest)
		return
	}

	// Validate and resolve path
	fullPath, err := fs.validatePath(path)
	if err != nil {
		log.Printf("❌ DiffContent path validation failed for %s: %v", path, err)
		userFriendlyError := getUserFriendlyError(err)
		http.Error(w, userFriendlyError, http.StatusBadRequest)
		return
	}

	// Check if file exists
	info, err := os.Stat(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			log.Printf("❌ DiffContent: File not found: %s", fullPath)
			http.Error(w, "File not found", http.StatusNotFound)
		} else {
			log.Printf("❌ DiffContent access denied for %s: %v", fullPath, err)
			http.Error(w, "Access denied", http.StatusForbidden)
		}
		return
	}

	// Ensure it's a file, not a directory
	if info.IsDir() {
		log.Printf("❌ DiffContent: Cannot get content of directory: %s", fullPath)
		http.Error(w, "Cannot get content of directory", http.StatusBadRequest)
		return
	}

	// Read current file content
	file, err := os.Open(fullPath)
	if err != nil {
		log.Printf("❌ DiffContent failed to open file %s: %v", fullPath, err)
		sentry.WithScope(func(scope *sentry.Scope) {
			scope.SetTag("operation", "diff_content")
			scope.SetContext("file_info", map[string]interface{}{
				"path": path,
				"full_path": fullPath,
			})
			sentry.CaptureException(err)
		})
		http.Error(w, "Failed to read file", http.StatusInternalServerError)
		return
	}
	defer file.Close()

	modifiedContent, err := io.ReadAll(file)
	if err != nil {
		log.Printf("❌ DiffContent failed to read file %s: %v", fullPath, err)
		http.Error(w, "Failed to read file", http.StatusInternalServerError)
		return
	}

	// For now, return current content as both original and modified
	// TODO: Integrate with git to get HEAD version
	diffContent := FileDiffContent{
		Path:            path,
		OriginalContent: string(modifiedContent), // TODO: Get from git HEAD
		ModifiedContent: string(modifiedContent),
		Language:        detectLanguage(fullPath),
	}

	log.Printf("✅ DiffContent: Returning content for %s (language: %s)", fullPath, diffContent.Language)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(diffContent)
}
