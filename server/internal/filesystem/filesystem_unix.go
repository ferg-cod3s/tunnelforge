//go:build !windows

package filesystem

import (
	"os"
	"strconv"
	"syscall"
)

// getUnixOwnerGroup extracts owner and group information on Unix systems
func getUnixOwnerGroup(info os.FileInfo, fileInfo *FileInfo) {
	if stat, ok := info.Sys().(*syscall.Stat_t); ok {
		fileInfo.Owner = strconv.Itoa(int(stat.Uid))
		fileInfo.Group = strconv.Itoa(int(stat.Gid))
	}
}
