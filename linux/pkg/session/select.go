//go:build darwin || linux
// +build darwin linux

package session

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

// selectRead performs a select() operation on multiple file descriptors
func selectRead(fds []int, timeout time.Duration) ([]int, error) {
	if len(fds) == 0 {
		return nil, fmt.Errorf("no file descriptors to select on")
	}

	// Find the highest FD number
	maxFd := 0
	for _, fd := range fds {
		if fd > maxFd {
			maxFd = fd
		}
	}

	// Create FD set
	var readSet syscall.FdSet
	for _, fd := range fds {
		fdSetAdd(&readSet, fd)
	}

	// Convert timeout to timeval
	tv := syscall.NsecToTimeval(timeout.Nanoseconds())

	// Perform select - handle platform differences
	err := selectCall(maxFd+1, &readSet, nil, nil, &tv)
	if err != nil {
		if err == syscall.EINTR || err == syscall.EAGAIN {
			return []int{}, nil // Interrupted or would block
		}
		return nil, err
	}

	// Check which FDs are ready
	var ready []int
	for _, fd := range fds {
		if fdIsSet(&readSet, fd) {
			ready = append(ready, fd)
		}
	}

	return ready, nil
}

// fdSetAdd adds a file descriptor to an FdSet
func fdSetAdd(set *syscall.FdSet, fd int) {
	set.Bits[fd/64] |= 1 << uint(fd%64)
}

// fdIsSet checks if a file descriptor is set in an FdSet
func fdIsSet(set *syscall.FdSet, fd int) bool {
	return set.Bits[fd/64]&(1<<uint(fd%64)) != 0
}

// pollWithSelect polls multiple file descriptors using select
func (p *PTY) pollWithSelect() error {
	// Buffer for reading
	buf := make([]byte, 32*1024)

	// Get file descriptors
	ptyFd := int(p.pty.Fd())
	var stdinFd int = -1
	
	// Only include stdin in polling if not using event-driven mode
	if !p.useEventDrivenStdin && p.stdinPipe != nil {
		stdinFd = int(p.stdinPipe.Fd())
	}

	// Open control FIFO in non-blocking mode
	controlPath := filepath.Join(p.session.Path(), "control")
	controlFile, err := os.OpenFile(controlPath, os.O_RDONLY|syscall.O_NONBLOCK, 0)
	var controlFd = -1
	if err == nil {
		controlFd = int(controlFile.Fd())
		defer func() {
			if err := controlFile.Close(); err != nil {
				log.Printf("[ERROR] Failed to close control file: %v", err)
			}
		}()
	} else {
		log.Printf("[WARN] Failed to open control FIFO: %v", err)
	}

	for {
		// Build FD list
		fds := []int{ptyFd}
		if stdinFd >= 0 {
			fds = append(fds, stdinFd)
		}
		if controlFd >= 0 {
			fds = append(fds, controlFd)
		}

		// Wait for activity with 100ms timeout for better responsiveness
		ready, err := selectRead(fds, 100*time.Millisecond)
		if err != nil {
			log.Printf("[ERROR] select error: %v", err)
			return err
		}

		// Check if process has exited
		if p.cmd.ProcessState != nil {
			return nil
		}

		// Process ready file descriptors
		for _, fd := range ready {
			switch fd {
			case ptyFd:
				// Read from PTY
				n, err := syscall.Read(ptyFd, buf)
				if err != nil {
					if err == syscall.EIO {
						// PTY closed
						return nil
					}
					log.Printf("[ERROR] PTY read error: %v", err)
					return err
				}
				if n > 0 {
					// Write to output
					if err := p.streamWriter.WriteOutput(buf[:n]); err != nil {
						log.Printf("[ERROR] Failed to write to stream: %v", err)
					}
				}

			case stdinFd:
				// Read from stdin FIFO
				n, err := syscall.Read(stdinFd, buf)
				if err != nil && err != syscall.EAGAIN {
					log.Printf("[ERROR] stdin read error: %v", err)
					continue
				}
				if n > 0 {
					// Write to PTY
					if _, err := p.pty.Write(buf[:n]); err != nil {
						log.Printf("[ERROR] Failed to write to PTY: %v", err)
					}
				}

			case controlFd:
				// Read from control FIFO
				n, err := syscall.Read(controlFd, buf)
				if err != nil && err != syscall.EAGAIN {
					log.Printf("[ERROR] control read error: %v", err)
					continue
				}
				if n > 0 {
					// Parse control commands
					cmdStr := string(buf[:n])
					for _, line := range strings.Split(cmdStr, "\n") {
						line = strings.TrimSpace(line)
						if line == "" {
							continue
						}

						var cmd ControlCommand
						if err := json.Unmarshal([]byte(line), &cmd); err != nil {
							log.Printf("[ERROR] Failed to parse control command: %v", err)
							continue
						}

						p.session.handleControlCommand(&cmd)
					}
				}
			}
		}
	}
}
