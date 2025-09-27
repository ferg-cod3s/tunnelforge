//go:build windows

package filesystem

import "os"

// getUnixOwnerGroup does nothing on Windows
func getUnixOwnerGroup(info os.FileInfo, fileInfo *FileInfo) {
	// Windows doesn't have Unix-style owner/group
}
