export function parseCommand(command: string): string[] {
  // Simple command parsing - split by spaces for now
  // In a real implementation, this would handle quotes, escaping, etc.
  return command.trim().split(/\s+/).filter(Boolean);
}