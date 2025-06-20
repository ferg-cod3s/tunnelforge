import Foundation

/// Represents a file or directory entry in the file system.
///
/// FileEntry contains metadata about a file or directory, including
/// its name, path, size, permissions, and modification time.
/// This model is typically used for file browser functionality.
struct FileEntry: Codable, Identifiable {
    let name: String
    let path: String
    let isDir: Bool
    let size: Int64
    let mode: String
    let modTime: Date

    var id: String { path }

    enum CodingKeys: String, CodingKey {
        case name
        case path
        case isDir = "is_dir"
        case size
        case mode
        case modTime = "mod_time"
    }

    /// Creates a FileEntry from a decoder.
    ///
    /// - Parameter decoder: The decoder to read data from.
    ///
    /// This custom initializer handles the special parsing of the modification
    /// time from ISO8601 format, supporting both fractional and non-fractional seconds.
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        name = try container.decode(String.self, forKey: .name)
        path = try container.decode(String.self, forKey: .path)
        isDir = try container.decode(Bool.self, forKey: .isDir)
        size = try container.decode(Int64.self, forKey: .size)
        mode = try container.decode(String.self, forKey: .mode)

        // Decode mod_time string as Date
        let modTimeString = try container.decode(String.self, forKey: .modTime)
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: modTimeString) {
            modTime = date
        } else {
            // Fallback without fractional seconds
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: modTimeString) {
                modTime = date
            } else {
                throw DecodingError.dataCorruptedError(
                    forKey: .modTime,
                    in: container,
                    debugDescription: "Invalid date format"
                )
            }
        }
    }

    /// Returns a human-readable file size string.
    ///
    /// Uses binary units (KiB, MiB, GiB) for formatting.
    /// Example: "1.5 MiB" for a file of 1,572,864 bytes.
    var formattedSize: String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .binary
        return formatter.string(fromByteCount: size)
    }

    /// Returns a relative date string for the modification time.
    ///
    /// Formats the modification time relative to the current date.
    /// Examples: "2 hours ago", "yesterday", "3 days ago".
    var formattedDate: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: modTime, relativeTo: Date())
    }
}

/// Represents a directory listing with its contents.
///
/// DirectoryListing contains the absolute path of a directory
/// and an array of FileEntry objects representing its contents.
struct DirectoryListing: Codable {
    /// The absolute path of the directory being listed.
    let absolutePath: String

    /// Array of file and subdirectory entries in this directory.
    let files: [FileEntry]
}
