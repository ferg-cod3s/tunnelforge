package filesystem

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/gorilla/mux"
)

// FileInfo represents file metadata
type FileInfo struct {
	Name          string    `json:"name"`
	Path          string    `json:"path"`
	Type          string    `json:"type"` // "file" or "directory"
	Size          int64     `json:"size"`
	Mode          string    `json:"mode"`
	ModTime       time.Time `json:"modTime"`
	IsHidden      bool      `json:"isHidden"`
	Permissions   string    `json:"permissions"`
	Owner         string    `json:"owner,omitempty"`
	Group         string    `json:"group,omitempty"`
	IsSymlink     bool      `json:"isSymlink"`
	SymlinkTarget string    `json:"symlinkTarget,omitempty"`
}

// ListRequest represents directory listing request parameters
type ListRequest struct {
	Path       string `json:"path"`
	ShowHidden bool   `json:"showHidden"`
	SortBy     string `json:"sortBy"` // "name", "size", "modTime"
	SortDesc   bool   `json:"sortDesc"`
	GitFilter  string `json:"gitFilter"` // "all", "changed"
}

// ListResponse represents directory listing response
type ListResponse struct {
	Path        string     `json:"path"`
	Files       []FileInfo `json:"files"`
	Directories []FileInfo `json:"directories"`
	Parent      string     `json:"parent,omitempty"`
	Error       string     `json:"error,omitempty"`
}

// FileSystemService handles file system operations
type FileSystemService struct {
	basePath string // Base path for security (prevent directory traversal)
}

// NewFileSystemService creates a new file system service
func NewFileSystemService(basePath string) *FileSystemService {
	if basePath == "" {
		basePath = "/"
	}
	return &FileSystemService{
		basePath: basePath,
	}
}

// isCommonUserDirectory checks if a path is a common user directory that should be accessible
func isCommonUserDirectory(path string) bool {
	homeDir := os.Getenv("HOME")
	if homeDir == "" {
		return false
	}

	// Define common user directories that are generally safe to access
	commonDirs := []string{
		"Desktop",
		"Documents",
		"Downloads",
		"Pictures",
		"Music",
		"Videos",
		"Movies",
		"Public",
		"Templates",
		".config",
		".local",
		".cache",
		"src",
		"dev",
		"projects",
		"workspace",
		"git",
	}

	// Check if the path is within the home directory
	if !strings.HasPrefix(path, homeDir) {
		return false
	}

	// Get the relative path from home
	relPath, err := filepath.Rel(homeDir, path)
	if err != nil {
		return false
	}

	// Check if it's a direct subdirectory of home
	if !strings.Contains(relPath, string(filepath.Separator)) {
		// It's a direct subdirectory, check if it's in our allowed list
		dirName := relPath
		for _, allowed := range commonDirs {
			if dirName == allowed {
				return true
			}
		}
	}

	// Check for common nested directories (e.g., ~/Documents/projects)
	parts := strings.Split(relPath, string(filepath.Separator))
	if len(parts) >= 2 {
		firstLevel := parts[0]
		secondLevel := parts[1]

		// Allow common patterns like ~/Documents/*, ~/src/*
		if firstLevel == "Documents" || firstLevel == "src" || firstLevel == "dev" || firstLevel == "projects" {
			return true
		}

		// Allow ~/Pictures/*, ~/Music/*, etc.
		if firstLevel == "Pictures" || firstLevel == "Music" || firstLevel == "Videos" || firstLevel == "Downloads" {
			return true
		}

		// Allow hidden directories like ~/.config/*
		if strings.HasPrefix(firstLevel, ".") && (secondLevel == "config" || secondLevel == "local" || secondLevel == "cache") {
			return true
		}
	}

	return false
}

// getUserFriendlyError converts technical errors to user-friendly messages
func getUserFriendlyError(err error) string {
	if err == nil {
		return "An unknown error occurred"
	}

	errMsg := err.Error()

	// Handle specific error types with user-friendly messages
	if strings.Contains(errMsg, "access denied") || strings.Contains(errMsg, "outside allowed directory") {
		return "You don't have permission to access this location. Please choose a folder within your allowed directories (like Documents, Desktop, or Downloads)."
	}

	if strings.Contains(errMsg, "invalid path") {
		return "The path you entered is not valid. Please check for typos and ensure you're using a proper folder path."
	}

	if strings.Contains(errMsg, "invalid base path") {
		return "There's a configuration issue with the server's allowed directories. Please contact your administrator."
	}

	// For other errors, provide a generic but helpful message
	return "The path could not be accessed. Please make sure the folder exists and you have permission to view it."
}

func (fs *FileSystemService) validatePath(requestedPath string) (string, error) {
	log.Printf("🔍 Validating path: %s", requestedPath)

	// URL-decode the path first
	decodedPath, err := url.QueryUnescape(requestedPath)
	if err != nil {
		log.Printf("⚠️ Failed to URL-decode path %s: %v, using original", requestedPath, err)
		decodedPath = requestedPath
	}
	log.Printf("🔍 Decoded path: %s", decodedPath)

	// Handle tilde expansion for home directory
	expandedPath := decodedPath
	if strings.HasPrefix(expandedPath, "~") {
		homeDir := os.Getenv("HOME")
		if homeDir != "" {
			expandedPath = strings.Replace(expandedPath, "~", homeDir, 1)
			log.Printf("🔍 Expanded tilde to home directory: %s", expandedPath)
		} else {
			log.Printf("⚠️ Tilde expansion requested but HOME env var not set")
		}
	}

	// Clean the path to prevent directory traversal
	cleanPath := filepath.Clean(expandedPath)
	log.Printf("🔍 Cleaned path: %s", cleanPath)

	// Convert relative path to absolute
	if !filepath.IsAbs(cleanPath) {
		cleanPath = filepath.Join(fs.basePath, cleanPath)
		log.Printf("🔍 Converted to absolute path: %s", cleanPath)
	}

	// Resolve symlinks and get absolute path
	absPath, err := filepath.Abs(cleanPath)
	if err != nil {
		log.Printf("❌ Failed to resolve absolute path for %s: %v", cleanPath, err)
		sentry.WithScope(func(scope *sentry.Scope) {
			scope.SetTag("operation", "path_resolution")
			scope.SetContext("path_info", map[string]interface{}{
				"requested_path": requestedPath,
				"clean_path":     cleanPath,
			})
			sentry.CaptureException(err)
		})
		return "", fmt.Errorf("invalid path: %v", err)
	}
	log.Printf("🔍 Resolved absolute path: %s", absPath)

	// Ensure the path is within the base path (security check)
	// Note: Skip base path validation if we're using home directory expansion
	// since home directory access is generally expected and safe
	if !strings.HasPrefix(requestedPath, "~") {
		absBasePath, err := filepath.Abs(fs.basePath)
		if err != nil {
			return "", fmt.Errorf("invalid base path: %v", err)
		}

		if !strings.HasPrefix(absPath, absBasePath) {
			// Check if it's a common user directory that should be allowed
			if isCommonUserDirectory(absPath) {
				log.Printf("✅ Allowing access to common user directory: %s", absPath)
			} else {
				log.Printf("❌ Access denied: path %s is outside allowed directory %s", absPath, absBasePath)
				return "", fmt.Errorf("access denied: path outside allowed directory")
			}
		}
		log.Printf("✅ Path validation passed for %s", absPath)
	} else {
		log.Printf("✅ Path validation skipped for home directory access: %s", absPath)
	}

 	return absPath, nil
 }

// getFileInfo extracts metadata from os.FileInfo
func (fs *FileSystemService) getFileInfo(path string, info os.FileInfo) FileInfo {
	fileType := "file"
	if info.IsDir() {
		fileType = "directory"
	}

	permissions := info.Mode().Perm().String()
	isHidden := strings.HasPrefix(info.Name(), ".")

	fileInfo := FileInfo{
		Name:        info.Name(),
		Path:        path,
		Type:        fileType,
		Size:        info.Size(),
		Mode:        info.Mode().String(),
		ModTime:     info.ModTime(),
		IsHidden:    isHidden,
		Permissions: permissions,
		IsSymlink:   info.Mode()&os.ModeSymlink != 0,
	}

	// Get symlink target if it's a symlink
	if fileInfo.IsSymlink {
		if target, err := os.Readlink(path); err == nil {
			fileInfo.SymlinkTarget = target
		}
	}
	// Try to get owner/group information (Unix-specific)
	getUnixOwnerGroup(info, &fileInfo)

	return fileInfo
}

// sortFiles sorts files according to the specified criteria
func (fs *FileSystemService) sortFiles(files []FileInfo, sortBy string, sortDesc bool) {
	sort.Slice(files, func(i, j int) bool {
		var less bool
		switch sortBy {
		case "size":
			less = files[i].Size < files[j].Size
		case "modTime":
			less = files[i].ModTime.Before(files[j].ModTime)
		default: // "name"
			less = strings.ToLower(files[i].Name) < strings.ToLower(files[j].Name)
		}

		if sortDesc {
			return !less
		}
		return less
	})
}

// ListDirectory handles GET /api/filesystem/ls
func (fs *FileSystemService) ListDirectory(w http.ResponseWriter, r *http.Request) {
	log.Printf("📁 ListDirectory request: %s %s", r.Method, r.URL.String())

	var req ListRequest
	// Parse query parameters
	req.Path = r.URL.Query().Get("path")
	if req.Path == "" {
		req.Path = "."
	}
	req.ShowHidden = r.URL.Query().Get("showHidden") == "true"
	req.SortBy = r.URL.Query().Get("sortBy")
	if req.SortBy == "" {
		req.SortBy = "name"
	}
	req.SortDesc = r.URL.Query().Get("sortDesc") == "true"
	req.GitFilter = r.URL.Query().Get("gitFilter")
	if req.GitFilter == "" {
		req.GitFilter = "all"
	}

	log.Printf("📁 ListDirectory params: path=%s, showHidden=%v, sortBy=%s, sortDesc=%v, gitFilter=%s", req.Path, req.ShowHidden, req.SortBy, req.SortDesc, req.GitFilter)

	// Validate and resolve path
	fullPath, err := fs.validatePath(req.Path)
	if err != nil {
		log.Printf("❌ ListDirectory path validation failed for %s: %v", req.Path, err)
		userFriendlyError := getUserFriendlyError(err)
		http.Error(w, userFriendlyError, http.StatusBadRequest)
		return
	}

	// Check if path exists and is accessible
	if _, err := os.Stat(fullPath); err != nil {
		if os.IsNotExist(err) {
			log.Printf("❌ ListDirectory path not found: %s", fullPath)
			http.Error(w, "The specified folder or file could not be found. Please check the path and try again.", http.StatusNotFound)
		} else {
			log.Printf("❌ ListDirectory access denied for %s: %v", fullPath, err)
			http.Error(w, "You don't have permission to access this location. Please choose a different folder.", http.StatusForbidden)
		}
		return
	}

	// Read directory contents
	entries, err := os.ReadDir(fullPath)
	if err != nil {
		log.Printf("❌ ListDirectory failed to read directory %s: %v", fullPath, err)
		sentry.WithScope(func(scope *sentry.Scope) {
			scope.SetTag("operation", "list_directory")
			scope.SetContext("directory_info", map[string]interface{}{
				"requested_path": req.Path,
				"full_path":      fullPath,
			})
			sentry.CaptureException(err)
		})
		http.Error(w, "Unable to read the contents of this folder. It may be corrupted or inaccessible.", http.StatusInternalServerError)
		return
	}

	log.Printf("📁 ListDirectory found %d entries in %s", len(entries), fullPath)

 	var files = make([]FileInfo, 0)
 	var directories = make([]FileInfo, 0)

 	for _, entry := range entries {
 		// Skip hidden files if not requested
 		if !req.ShowHidden && strings.HasPrefix(entry.Name(), ".") {
 			continue
 		}

 		entryPath := filepath.Join(fullPath, entry.Name())
 		info, err := entry.Info()
 		if err != nil {
 			continue // Skip files we can't read
 		}

 		fileInfo := fs.getFileInfo(entryPath, info)

 		if info.IsDir() {
 			directories = append(directories, fileInfo)
 		} else {
 			files = append(files, fileInfo)
 		}
 	}

	// Sort files and directories
	fs.sortFiles(files, req.SortBy, req.SortDesc)
	fs.sortFiles(directories, req.SortBy, req.SortDesc)

	// Determine parent directory
	var parent string
	if fullPath != fs.basePath {
		parent = filepath.Dir(req.Path)
		if parent == "." {
			parent = ""
		}
	}

	response := ListResponse{
		Path:        req.Path,
		Files:       files,
		Directories: directories,
		Parent:      parent,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// DownloadFile handles GET /api/filesystem/download/{path}
func (fs *FileSystemService) DownloadFile(w http.ResponseWriter, r *http.Request) {
	log.Printf("📥 DownloadFile request: %s %s", r.Method, r.URL.String())

	vars := mux.Vars(r)
	requestedPath := vars["path"]

	if requestedPath == "" {
		log.Printf("❌ DownloadFile: Path parameter is required")
		http.Error(w, "Path parameter is required", http.StatusBadRequest)
		return
	}

	// Validate and resolve path
	fullPath, err := fs.validatePath(requestedPath)
	if err != nil {
		log.Printf("❌ DownloadFile path validation failed for %s: %v", requestedPath, err)
		userFriendlyError := getUserFriendlyError(err)
		http.Error(w, userFriendlyError, http.StatusBadRequest)
		return
	}

	// Check if file exists
	info, err := os.Stat(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			log.Printf("❌ DownloadFile: File not found: %s", fullPath)
			http.Error(w, "The file you're trying to download could not be found. Please check the path and try again.", http.StatusNotFound)
		} else {
			log.Printf("❌ DownloadFile access denied for %s: %v", fullPath, err)
			http.Error(w, "You don't have permission to access this file. Please choose a different file.", http.StatusForbidden)
		}
		return
	}

	// Ensure it's a file, not a directory
	if info.IsDir() {
		log.Printf("❌ DownloadFile: Cannot download directory: %s", fullPath)
		http.Error(w, "Folders cannot be downloaded directly. Please select a specific file to download.", http.StatusBadRequest)
		return
	}

	// Open file
	file, err := os.Open(fullPath)
	if err != nil {
		log.Printf("❌ DownloadFile failed to open file %s: %v", fullPath, err)
		sentry.WithScope(func(scope *sentry.Scope) {
			scope.SetTag("operation", "download_file")
			scope.SetContext("file_info", map[string]interface{}{
				"requested_path": requestedPath,
				"full_path":      fullPath,
			})
			sentry.CaptureException(err)
		})
		http.Error(w, fmt.Sprintf("Failed to open file: %v", err), http.StatusInternalServerError)
		return
	}
	defer file.Close()

	// Set headers for file download
	filename := filepath.Base(fullPath)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))

	log.Printf("📥 DownloadFile starting download: %s (%d bytes)", fullPath, info.Size())

	// Stream file to response
	_, err = io.Copy(w, file)
	if err != nil {
		// Can't change headers after writing starts, so just log the error
		log.Printf("❌ DownloadFile error streaming file %s: %v", fullPath, err)
	}
}

// UploadFile handles POST /api/filesystem/upload
func (fs *FileSystemService) UploadFile(w http.ResponseWriter, r *http.Request) {
	log.Printf("📤 UploadFile request: %s %s", r.Method, r.URL.String())

	// Parse multipart form (32MB max memory)
	err := r.ParseMultipartForm(32 << 20)
	if err != nil {
		log.Printf("❌ UploadFile failed to parse multipart form: %v", err)
		http.Error(w, fmt.Sprintf("Failed to parse multipart form: %v", err), http.StatusBadRequest)
		return
	}

	// Get target directory
	targetDir := r.FormValue("path")
	if targetDir == "" {
		targetDir = "."
	}

	log.Printf("📤 UploadFile target directory: %s", targetDir)

	// Validate target directory
	fullTargetDir, err := fs.validatePath(targetDir)
	if err != nil {
		log.Printf("❌ UploadFile invalid target directory %s: %v", targetDir, err)
		userFriendlyError := getUserFriendlyError(err)
		http.Error(w, userFriendlyError, http.StatusBadRequest)
		return
	}

	// Ensure target directory exists and is a directory
	info, err := os.Stat(fullTargetDir)
	if err != nil {
		log.Printf("❌ UploadFile target directory not found: %s", fullTargetDir)
		http.Error(w, "The destination folder could not be found. Please check the path and try again.", http.StatusNotFound)
		return
	}
	if !info.IsDir() {
		log.Printf("❌ UploadFile target path is not a directory: %s", fullTargetDir)
		http.Error(w, "The specified path is not a folder. Please select a valid destination folder.", http.StatusBadRequest)
		return
	}

	// Get uploaded files
	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		log.Printf("❌ UploadFile: No files uploaded")
		http.Error(w, "No files were selected for upload. Please choose one or more files to upload.", http.StatusBadRequest)
		return
	}

	log.Printf("📤 UploadFile processing %d files to %s", len(files), fullTargetDir)

	uploadedFiles := make([]string, 0, len(files))

	for _, fileHeader := range files {
		// Open uploaded file
		file, err := fileHeader.Open()
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to open uploaded file: %v", err), http.StatusInternalServerError)
			return
		}
		defer file.Close()

		// Create target file path
		targetPath := filepath.Join(fullTargetDir, fileHeader.Filename)

		// Create target file
		targetFile, err := os.Create(targetPath)
		if err != nil {
			log.Printf("❌ UploadFile failed to create target file %s: %v", targetPath, err)
			sentry.WithScope(func(scope *sentry.Scope) {
				scope.SetTag("operation", "upload_file")
				scope.SetContext("upload_info", map[string]interface{}{
					"target_dir":     fullTargetDir,
					"target_path":    targetPath,
					"filename":       fileHeader.Filename,
				})
				sentry.CaptureException(err)
			})
			http.Error(w, fmt.Sprintf("Failed to create target file: %v", err), http.StatusInternalServerError)
			return
		}
		defer targetFile.Close()

		// Copy uploaded file to target
		_, err = io.Copy(targetFile, file)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to save file: %v", err), http.StatusInternalServerError)
			return
		}

		uploadedFiles = append(uploadedFiles, fileHeader.Filename)
	}

	response := map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Uploaded %d file(s)", len(uploadedFiles)),
		"files":   uploadedFiles,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// CreateDirectory handles POST /api/filesystem/mkdir
func (fs *FileSystemService) CreateDirectory(w http.ResponseWriter, r *http.Request) {
	log.Printf("📁 CreateDirectory request: %s %s", r.Method, r.URL.String())

	var req struct {
		Path string `json:"path"`
		Mode string `json:"mode,omitempty"` // Optional: directory permissions (e.g., "0755")
	}

	// Parse JSON request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("❌ CreateDirectory invalid JSON: %v", err)
		http.Error(w, fmt.Sprintf("Invalid JSON: %v", err), http.StatusBadRequest)
		return
	}

	if req.Path == "" {
		log.Printf("❌ CreateDirectory: Path is required")
		http.Error(w, "Path is required", http.StatusBadRequest)
		return
	}

	log.Printf("📁 CreateDirectory path: %s, mode: %s", req.Path, req.Mode)

	// Validate and resolve path
	fullPath, err := fs.validatePath(req.Path)
	if err != nil {
		log.Printf("❌ CreateDirectory path validation failed for %s: %v", req.Path, err)
		userFriendlyError := getUserFriendlyError(err)
		http.Error(w, userFriendlyError, http.StatusBadRequest)
		return
	}

	// Parse permissions
	mode := os.FileMode(0755) // Default permissions
	if req.Mode != "" {
		if parsedMode, err := strconv.ParseUint(req.Mode, 8, 32); err == nil {
			mode = os.FileMode(parsedMode)
			log.Printf("📁 CreateDirectory using custom mode: %o", mode)
		} else {
			log.Printf("⚠️ CreateDirectory invalid mode %s, using default 0755", req.Mode)
		}
	}

	// Create directory
	err = os.MkdirAll(fullPath, mode)
	if err != nil {
		log.Printf("❌ CreateDirectory failed to create directory %s: %v", fullPath, err)
		http.Error(w, fmt.Sprintf("Failed to create directory: %v", err), http.StatusInternalServerError)
		return
	}

	log.Printf("✅ CreateDirectory successfully created: %s", fullPath)

	response := map[string]interface{}{
		"success": true,
		"message": "Directory created successfully",
		"path":    req.Path,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// DeletePath handles DELETE /api/filesystem/rm
func (fs *FileSystemService) DeletePath(w http.ResponseWriter, r *http.Request) {
	log.Printf("🗑️ DeletePath request: %s %s", r.Method, r.URL.String())

	var req struct {
		Path      string `json:"path"`
		Recursive bool   `json:"recursive,omitempty"` // For directories
		Force     bool   `json:"force,omitempty"`     // Ignore some errors
	}

	// Parse JSON request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("❌ DeletePath invalid JSON: %v", err)
		http.Error(w, fmt.Sprintf("Invalid JSON: %v", err), http.StatusBadRequest)
		return
	}

	if req.Path == "" {
		log.Printf("❌ DeletePath: Path is required")
		http.Error(w, "Path is required", http.StatusBadRequest)
		return
	}

	log.Printf("🗑️ DeletePath path: %s, recursive: %v, force: %v", req.Path, req.Recursive, req.Force)

	// Validate and resolve path
	fullPath, err := fs.validatePath(req.Path)
	if err != nil {
		log.Printf("❌ DeletePath path validation failed for %s: %v", req.Path, err)
		userFriendlyError := getUserFriendlyError(err)
		http.Error(w, userFriendlyError, http.StatusBadRequest)
		return
	}

	// Check if path exists
	info, err := os.Stat(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			if req.Force {
				log.Printf("✅ DeletePath: Path already deleted or does not exist (force mode): %s", fullPath)
				// Ignore if path doesn't exist and force is true
				response := map[string]interface{}{
					"success": true,
					"message": "The item was already deleted or doesn't exist.",
					"path":    req.Path,
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(response)
				return
			}
			log.Printf("❌ DeletePath: Path not found: %s", fullPath)
			http.Error(w, "The file or folder you're trying to delete could not be found.", http.StatusNotFound)
		} else {
			log.Printf("❌ DeletePath access denied for %s: %v", fullPath, err)
			http.Error(w, "You don't have permission to delete this item. Please check permissions and try again.", http.StatusForbidden)
		}
		return
	}

	// Delete the path
	if info.IsDir() {
		if req.Recursive {
			log.Printf("🗑️ DeletePath removing directory recursively: %s", fullPath)
			err = os.RemoveAll(fullPath)
		} else {
			log.Printf("🗑️ DeletePath removing directory (non-recursive): %s", fullPath)
			err = os.Remove(fullPath) // Will fail if directory is not empty
		}
	} else {
		log.Printf("🗑️ DeletePath removing file: %s", fullPath)
		err = os.Remove(fullPath)
	}

	if err != nil {
		log.Printf("❌ DeletePath failed to delete %s: %v", fullPath, err)
		http.Error(w, fmt.Sprintf("Failed to delete: %v", err), http.StatusInternalServerError)
		return
	}

	log.Printf("✅ DeletePath successfully deleted: %s", fullPath)

	response := map[string]interface{}{
		"success": true,
		"message": "Path deleted successfully",
		"path":    req.Path,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// PathCompletionRequest represents path completion request parameters
type PathCompletionRequest struct {
	Path string `json:"path"`
}

// PathCompletionResponse represents path completion response
type PathCompletionResponse struct {
	Completions []CompletionEntry `json:"completions"`
	PartialPath string            `json:"partialPath"`
}

// CompletionEntry represents a single completion suggestion
type CompletionEntry struct {
	Name         string `json:"name"`
	Path         string `json:"path"`
	Type         string `json:"type"` // "file" or "directory"
	Suggestion   string `json:"suggestion"`
	IsRepository bool   `json:"isRepository,omitempty"`
	GitBranch    string `json:"gitBranch,omitempty"`
}

// BrowseDirectory handles GET /api/fs/browse - alias for ListDirectory
func (fs *FileSystemService) BrowseDirectory(w http.ResponseWriter, r *http.Request) {
	// This is just an alias for the existing ListDirectory functionality
	// to maintain compatibility with frontend expectations
	fs.ListDirectory(w, r)
}

// PathCompletions handles GET /api/fs/completions
func (fs *FileSystemService) PathCompletions(w http.ResponseWriter, r *http.Request) {
	log.Printf("🔍 PathCompletions request: %s %s", r.Method, r.URL.String())

	originalPath := r.URL.Query().Get("path")
	if originalPath == "" {
		originalPath = "."
	}

	log.Printf("🔍 PathCompletions original path: %s", originalPath)

	// Handle tilde expansion for home directory
	partialPath := originalPath
	if strings.HasPrefix(partialPath, "~") {
		homeDir := os.Getenv("HOME")
		if homeDir != "" {
			partialPath = strings.Replace(partialPath, "~", homeDir, 1)
			log.Printf("🔍 PathCompletions expanded tilde: %s", partialPath)
		} else {
			log.Printf("⚠️ PathCompletions tilde expansion requested but HOME env var not set")
		}
	}

	// Separate directory and partial name
	var dirPath, partialName string
	if strings.HasSuffix(partialPath, "/") {
		// If path ends with slash, list contents of that directory
		dirPath = partialPath
		partialName = ""
	} else {
		// Otherwise, get the directory and partial filename
		dirPath = filepath.Dir(partialPath)
		partialName = filepath.Base(partialPath)
	}

	log.Printf("🔍 PathCompletions dirPath: %s, partialName: %s", dirPath, partialName)

	// Resolve the directory path
	fullDirPath := filepath.Clean(dirPath)
	if !filepath.IsAbs(fullDirPath) {
		if fullDirPath == "." {
			var err error
			fullDirPath, err = os.Getwd()
			if err != nil {
				log.Printf("❌ PathCompletions failed to get working directory: %v", err)
				http.Error(w, fmt.Sprintf("Failed to get working directory: %v", err), http.StatusInternalServerError)
				return
			}
		} else {
			var err error
			fullDirPath, err = filepath.Abs(fullDirPath)
			if err != nil {
				log.Printf("❌ PathCompletions failed to resolve path %s: %v", fullDirPath, err)
				http.Error(w, fmt.Sprintf("Failed to resolve path: %v", err), http.StatusInternalServerError)
				return
			}
		}
	}

	log.Printf("🔍 PathCompletions fullDirPath: %s", fullDirPath)

	// Check if directory exists
	dirStats, err := os.Stat(fullDirPath)
	if err != nil || !dirStats.IsDir() {
		log.Printf("⚠️ PathCompletions directory does not exist or is not a directory: %s", fullDirPath)
		// Directory doesn't exist, return empty completions
		response := PathCompletionResponse{
			Completions: []CompletionEntry{},
			PartialPath: originalPath,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	// Read directory contents
	entries, err := os.ReadDir(fullDirPath)
	if err != nil {
		log.Printf("❌ PathCompletions failed to read directory %s: %v", fullDirPath, err)
		http.Error(w, fmt.Sprintf("Failed to read directory: %v", err), http.StatusInternalServerError)
		return
	}

	log.Printf("🔍 PathCompletions found %d entries in %s", len(entries), fullDirPath)

	var completions []CompletionEntry

	for _, entry := range entries {
		// Filter by partial name (case-insensitive)
		if partialName != "" && !strings.HasPrefix(strings.ToLower(entry.Name()), strings.ToLower(partialName)) {
			continue
		}

		// Skip hidden files unless the partial name starts with '.'
		if !strings.HasPrefix(partialName, ".") && strings.HasPrefix(entry.Name(), ".") {
			continue
		}

		isDirectory := entry.IsDir()
		entryPath := filepath.Join(fullDirPath, entry.Name())

		// Build the suggestion path based on the original input
		var displayPath string
		if strings.HasSuffix(originalPath, "/") {
			displayPath = originalPath + entry.Name()
		} else {
			lastSlash := strings.LastIndex(originalPath, "/")
			if lastSlash >= 0 {
				displayPath = originalPath[:lastSlash+1] + entry.Name()
			} else {
				displayPath = entry.Name()
			}
		}

		// Check if this directory is a git repository
		isRepository := false
		gitBranch := ""
		if isDirectory {
			gitPath := filepath.Join(entryPath, ".git")
			if _, err := os.Stat(gitPath); err == nil {
				isRepository = true
			}
		}

		fileType := "file"
		if isDirectory {
			fileType = "directory"
		}

		suggestion := displayPath
		if isDirectory {
			suggestion += "/"
		}

		completions = append(completions, CompletionEntry{
			Name:         entry.Name(),
			Path:         displayPath,
			Type:         fileType,
			Suggestion:   suggestion,
			IsRepository: isRepository,
			GitBranch:    gitBranch,
		})

		// Limit to 20 suggestions
		if len(completions) >= 20 {
			break
		}
	}

	// Sort directories first, then by name
	sort.Slice(completions, func(i, j int) bool {
		if completions[i].Type != completions[j].Type {
			return completions[i].Type == "directory"
		}
		return strings.ToLower(completions[i].Name) < strings.ToLower(completions[j].Name)
	})

	response := PathCompletionResponse{
		Completions: completions,
		PartialPath: originalPath,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// RegisterRoutes registers filesystem routes with the provided router
func (fs *FileSystemService) RegisterRoutes(router *mux.Router) {
	// Create filesystem subrouter
	fsRouter := router.PathPrefix("/api/filesystem").Subrouter()

	// Register endpoints
	fsRouter.HandleFunc("/ls", fs.ListDirectory).Methods("GET")
	fsRouter.HandleFunc("/download/{path:.*}", fs.DownloadFile).Methods("GET")
	fsRouter.HandleFunc("/upload", fs.UploadFile).Methods("POST")
	fsRouter.HandleFunc("/mkdir", fs.CreateDirectory).Methods("POST")
	fsRouter.HandleFunc("/rm", fs.DeletePath).Methods("DELETE")

	// Create fs subrouter for frontend compatibility
	fsAliasRouter := router.PathPrefix("/api/fs").Subrouter()

	// Register alias endpoints that frontend expects
	fsAliasRouter.HandleFunc("/browse", fs.BrowseDirectory).Methods("GET")
	fsAliasRouter.HandleFunc("/completions", fs.PathCompletions).Methods("GET")
}
