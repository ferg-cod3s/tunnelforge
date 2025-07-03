import SwiftUI

/// Displays git repository information in a compact row.
///
/// Shows repository folder name, current branch, and change status
/// with clickable navigation to open the repository in Finder.
struct GitRepositoryRow: View {
    let repository: GitRepository
    @State private var isHovering = false
    @Environment(\.colorScheme)
    private var colorScheme

    private var gitAppName: String {
        if let preferredApp = UserDefaults.standard.string(forKey: "preferredGitApp"),
           !preferredApp.isEmpty,
           let gitApp = GitApp(rawValue: preferredApp)
        {
            return gitApp.displayName
        }
        // Return first installed git app or default
        return GitApp.installed.first?.displayName ?? "Git App"
    }

    private var branchInfo: some View {
        HStack(spacing: 1) {
            Image(systemName: "arrow.branch")
                .font(.system(size: 9))
                .foregroundColor(AppColors.Fallback.gitBranch(for: colorScheme))

            Text(repository.currentBranch ?? "detached")
                .font(.system(size: 10))
                .foregroundColor(AppColors.Fallback.gitBranch(for: colorScheme))
                .lineLimit(1)
                .truncationMode(.middle)
        }
    }

    private var changeIndicators: some View {
        Group {
            if repository.hasChanges {
                HStack(spacing: 3) {
                    if repository.modifiedCount > 0 {
                        HStack(spacing: 1) {
                            Image(systemName: "arrow.trianglehead.2.clockwise.rotate.90")
                                .font(.system(size: 8))
                                .foregroundColor(AppColors.Fallback.gitModified(for: colorScheme))
                            Text("\(repository.modifiedCount)")
                                .font(.system(size: 9, weight: .medium))
                                .foregroundColor(AppColors.Fallback.gitModified(for: colorScheme))
                        }
                    }
                    if repository.addedCount > 0 {
                        HStack(spacing: 1) {
                            Image(systemName: "plus")
                                .font(.system(size: 8, weight: .medium))
                                .foregroundColor(AppColors.Fallback.gitAdded(for: colorScheme))
                            Text("\(repository.addedCount)")
                                .font(.system(size: 9, weight: .medium))
                                .foregroundColor(AppColors.Fallback.gitAdded(for: colorScheme))
                        }
                    }
                    if repository.deletedCount > 0 {
                        HStack(spacing: 1) {
                            Image(systemName: "minus")
                                .font(.system(size: 8, weight: .medium))
                                .foregroundColor(AppColors.Fallback.gitDeleted(for: colorScheme))
                            Text("\(repository.deletedCount)")
                                .font(.system(size: 9, weight: .medium))
                                .foregroundColor(AppColors.Fallback.gitDeleted(for: colorScheme))
                        }
                    }
                    if repository.untrackedCount > 0 {
                        HStack(spacing: 1) {
                            Image(systemName: "questionmark")
                                .font(.system(size: 8))
                                .foregroundColor(AppColors.Fallback.gitUntracked(for: colorScheme))
                            Text("\(repository.untrackedCount)")
                                .font(.system(size: 9, weight: .medium))
                                .foregroundColor(AppColors.Fallback.gitUntracked(for: colorScheme))
                        }
                    }
                }
            }
        }
    }

    private var backgroundView: some View {
        RoundedRectangle(cornerRadius: 4)
            .fill(backgroundFillColor)
    }

    private var backgroundFillColor: Color {
        // Show background on hover - stronger in light mode
        if isHovering {
            return colorScheme == .light 
                ? AppColors.Fallback.controlBackground(for: colorScheme).opacity(0.25)
                : AppColors.Fallback.controlBackground(for: colorScheme).opacity(0.15)
        }
        return Color.clear
    }

    private var borderView: some View {
        RoundedRectangle(cornerRadius: 4)
            .strokeBorder(borderColor, lineWidth: 0.5)
    }

    private var borderColor: Color {
        // Show border on hover - stronger in light mode
        if isHovering {
            return colorScheme == .light
                ? AppColors.Fallback.gitBorder(for: colorScheme).opacity(0.3)
                : AppColors.Fallback.gitBorder(for: colorScheme).opacity(0.2)
        }
        return Color.clear
    }

    var body: some View {
        HStack(spacing: 2) {
            // Branch info
            branchInfo

            if repository.hasChanges {
                Text("•")
                    .font(.system(size: 8))
                    .foregroundColor(.secondary.opacity(0.5))
                
                changeIndicators
            }
            
            Spacer()
        }
        .padding(.horizontal, 4)
        .padding(.vertical, 2)
        .background(backgroundView)
        .overlay(borderView)
        .onHover { hovering in
            isHovering = hovering
        }
        .onTapGesture {
            openInGitApp()
        }
        .help("Open in \(gitAppName)")
        .animation(.easeInOut(duration: 0.15), value: isHovering)
    }

    private func openInGitApp() {
        GitAppLauncher.shared.openRepository(at: repository.path)
    }
}
