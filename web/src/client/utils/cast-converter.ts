// Utility class to convert asciinema cast files to data for DOM terminal
// Converts cast format to string data that can be written via terminal.write()

interface CastHeader {
  version: number;
  width: number;
  height: number;
  timestamp?: number;
  env?: Record<string, string>;
}

interface CastEvent {
  timestamp: number;
  type: 'o' | 'i' | 'r'; // output, input, or resize
  data: string;
}

export interface ConvertedCast {
  header: CastHeader | null;
  content: string; // All output data concatenated
  events: CastEvent[]; // Original events for advanced usage
  totalDuration: number; // Duration in seconds
}

export class CastConverter {
  /**
   * Convert cast file content to data for DOM terminal
   * @param castContent - Raw cast file content (asciinema format)
   * @returns Converted cast data
   */
  static convertCast(castContent: string): ConvertedCast {
    const lines = castContent.trim().split('\n');
    let header: CastHeader | null = null;
    const events: CastEvent[] = [];
    const outputChunks: string[] = [];
    let totalDuration = 0;

    // Parse each line of the cast file
    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const parsed = JSON.parse(line);

        // Check if this is a header line
        if (parsed.version && parsed.width && parsed.height) {
          header = parsed as CastHeader;
          continue;
        }

        // Check if this is an event line [timestamp, type, data]
        if (Array.isArray(parsed) && parsed.length >= 3) {
          const event: CastEvent = {
            timestamp: parsed[0],
            type: parsed[1],
            data: parsed[2],
          };

          events.push(event);

          // Track total duration
          if (event.timestamp > totalDuration) {
            totalDuration = event.timestamp;
          }

          // Collect output events for concatenated content
          if (event.type === 'o') {
            outputChunks.push(event.data);
          }
        }
      } catch (error) {
        console.warn('Failed to parse cast line:', line, error);
      }
    }

    return {
      header,
      content: outputChunks.join(''),
      events,
      totalDuration,
    };
  }

  /**
   * Load and convert cast file from URL
   * @param url - URL to the cast file
   * @returns Promise with converted cast data
   */
  static async loadAndConvert(url: string): Promise<ConvertedCast> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load cast file: ${response.status} ${response.statusText}`);
    }
    const content = await response.text();
    return this.convertCast(content);
  }

  /**
   * Convert cast to output-only content (filters out input/resize events)
   * @param castContent - Raw cast file content
   * @returns Just the output content as a string
   */
  static convertToOutputOnly(castContent: string): string {
    const converted = this.convertCast(castContent);
    return converted.content;
  }

  /**
   * Get terminal dimensions from cast header
   * @param castContent - Raw cast file content
   * @returns Terminal dimensions or defaults
   */
  static getTerminalDimensions(castContent: string): { cols: number; rows: number } {
    const converted = this.convertCast(castContent);
    return {
      cols: converted.header?.width || 80,
      rows: converted.header?.height || 24,
    };
  }

  /**
   * Convert cast events to timed playback data
   * @param castContent - Raw cast file content
   * @returns Array of timed events for animation playback
   */
  static convertToTimedEvents(castContent: string): Array<{
    delay: number; // Milliseconds to wait before this event
    type: 'output' | 'resize';
    data: string;
    cols?: number;
    rows?: number;
  }> {
    const converted = this.convertCast(castContent);
    const timedEvents: Array<{
      delay: number;
      type: 'output' | 'resize';
      data: string;
      cols?: number;
      rows?: number;
    }> = [];

    let lastTimestamp = 0;

    for (const event of converted.events) {
      const delay = Math.max(0, (event.timestamp - lastTimestamp) * 1000); // Convert to milliseconds

      if (event.type === 'o') {
        timedEvents.push({
          delay,
          type: 'output',
          data: event.data,
        });
      } else if (event.type === 'r') {
        // Parse resize data "WIDTHxHEIGHT"
        const match = event.data.match(/^(\d+)x(\d+)$/);
        if (match) {
          timedEvents.push({
            delay,
            type: 'resize',
            data: event.data,
            cols: parseInt(match[1], 10),
            rows: parseInt(match[2], 10),
          });
        }
      }

      lastTimestamp = event.timestamp;
    }

    return timedEvents;
  }

  /**
   * Helper to play cast content with timing on a DOM terminal
   * @param terminal - DOM terminal instance with write() method
   * @param castContent - Raw cast file content
   * @param speedMultiplier - Playback speed (1.0 = normal, 2.0 = 2x speed, etc.)
   * @returns Promise that resolves when playback is complete
   */
  static async playOnTerminal(
    terminal: {
      write: (data: string) => void;
      setTerminalSize?: (cols: number, rows: number) => void;
    },
    castContent: string,
    speedMultiplier: number = 1.0
  ): Promise<void> {
    const timedEvents = this.convertToTimedEvents(castContent);
    const converted = this.convertCast(castContent);

    // Set initial terminal size if possible
    if (terminal.setTerminalSize && converted.header) {
      terminal.setTerminalSize(converted.header.width, converted.header.height);
    }

    // Play events with timing
    for (const event of timedEvents) {
      const adjustedDelay = event.delay / speedMultiplier;

      if (adjustedDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, adjustedDelay));
      }

      if (event.type === 'output') {
        terminal.write(event.data);
      } else if (event.type === 'resize' && terminal.setTerminalSize && event.cols && event.rows) {
        terminal.setTerminalSize(event.cols, event.rows);
      }
    }
  }

  /**
   * Dump entire cast content to terminal instantly as a single write operation.
   * This is the fastest way to load cast content - builds one string and writes it all at once.
   * Handles resize events by applying the final dimensions to the terminal.
   *
   * @param terminal - DOM terminal instance with write() and setTerminalSize() methods
   * @param castContent - Raw cast file content
   * @returns Promise that resolves when dump is complete
   */
  static async dumpToTerminal(
    terminal: {
      write: (data: string, followCursor?: boolean) => void;
      setTerminalSize?: (cols: number, rows: number) => void;
    },
    castContent: string
  ): Promise<void> {
    const converted = this.convertCast(castContent);

    // Track final terminal dimensions from resize events
    let finalCols = converted.header?.width || 80;
    let finalRows = converted.header?.height || 24;

    // Build up output string and track final resize dimensions
    const outputChunks: string[] = [];

    for (const event of converted.events) {
      if (event.type === 'o') {
        // Output event - add to content
        outputChunks.push(event.data);
      } else if (event.type === 'r') {
        // Resize event - track final dimensions
        const match = event.data.match(/^(\d+)x(\d+)$/);
        if (match) {
          finalCols = parseInt(match[1], 10);
          finalRows = parseInt(match[2], 10);
        }
      }
      // Ignore 'i' (input) events for dump
    }

    // Apply final terminal size first if we have resize capability
    if (terminal.setTerminalSize) {
      terminal.setTerminalSize(finalCols, finalRows);
    }

    // Write all content at once as a single operation (fastest possible)
    const allContent = outputChunks.join('');
    if (allContent) {
      terminal.write(allContent, false); // Don't follow cursor during dump for performance
    }
  }
}
