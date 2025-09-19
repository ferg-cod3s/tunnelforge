#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print size in human-readable format
print_size() {
    local size=$1
    if [ $size -gt $((1024 * 1024 * 1024)) ]; then
        echo "$(bc <<< "scale=2; $size / (1024 * 1024 * 1024)")GB"
    elif [ $size -gt $((1024 * 1024)) ]; then
        echo "$(bc <<< "scale=2; $size / (1024 * 1024)")MB"
    elif [ $size -gt 1024 ]; then
        echo "$(bc <<< "scale=2; $size / 1024")KB"
    else
        echo "${size}B"
    fi
}

# Function to calculate directory size
get_size() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        stat -f%z "$1"
    else
        stat -c%s "$1"
    fi
}

# Function to remove directory if exists
remove_if_exists() {
    local dir=$1
    if [ -d "$dir" ]; then
        size=$(du -s "$dir" | cut -f1)
        rm -rf "$dir"
        echo -e "${GREEN}Removed${NC} $dir ($(print_size $size))"
        return 0
    fi
    return 1
}

echo -e "${YELLOW}Starting cleanup of build artifacts...${NC}"

# Track total space saved
total_saved=0

# Clean Rust build artifacts
echo -e "\n${YELLOW}Cleaning Rust build artifacts...${NC}"
find . -type d -name "target" | while read -r dir; do
    size=$(du -s "$dir" | cut -f1)
    rm -rf "$dir"
    total_saved=$((total_saved + size))
    echo -e "${GREEN}Removed${NC} $dir ($(print_size $size))"
done

# Clean Node.js build artifacts
echo -e "\n${YELLOW}Cleaning Node.js build artifacts...${NC}"
find . -type d -name "node_modules" | while read -r dir; do
    size=$(du -s "$dir" | cut -f1)
    rm -rf "$dir"
    total_saved=$((total_saved + size))
    echo -e "${GREEN}Removed${NC} $dir ($(print_size $size))"
done

# Clean Swift build artifacts
echo -e "\n${YELLOW}Cleaning Swift build artifacts...${NC}"
dirs_to_clean=(
    "mac/.build"
    "mac/build"
    "ios/build"
    "build"
    ".build"
)

for dir in "${dirs_to_clean[@]}"; do
    if remove_if_exists "$dir"; then
        size=$(du -s "$dir" | cut -f1)
        total_saved=$((total_saved + size))
    fi
done

# Clean Xcode derived data
echo -e "\n${YELLOW}Cleaning Xcode derived data...${NC}"
if [ -d ~/Library/Developer/Xcode/DerivedData ]; then
    size=$(du -s ~/Library/Developer/Xcode/DerivedData | cut -f1)
    rm -rf ~/Library/Developer/Xcode/DerivedData/*
    total_saved=$((total_saved + size))
    echo -e "${GREEN}Cleaned${NC} Xcode DerivedData ($(print_size $size))"
fi

# Clean Bun build artifacts
echo -e "\n${YELLOW}Cleaning Bun build artifacts...${NC}"
find . -type d -name ".bun" | while read -r dir; do
    size=$(du -s "$dir" | cut -f1)
    rm -rf "$dir"
    total_saved=$((total_saved + size))
    echo -e "${GREEN}Removed${NC} $dir ($(print_size $size))"
done

# Clean other build artifacts
echo -e "\n${YELLOW}Cleaning other build artifacts...${NC}"
other_patterns=(
    "*.rlib"
    "*.rmeta"
    "*.dylib"
    "*.so"
    "*.dll"
    "*.exe"
    "*.o"
    "*.out"
)

for pattern in "${other_patterns[@]}"; do
    find . -type f -name "$pattern" | while read -r file; do
        size=$(get_size "$file")
        rm -f "$file"
        total_saved=$((total_saved + size))
        echo -e "${GREEN}Removed${NC} $file ($(print_size $size))"
    done
done

# Print summary
echo -e "\n${GREEN}Cleanup complete!${NC}"
echo -e "Total space saved: $(print_size $total_saved)"

# Run git gc if we cleaned up a significant amount of space
if [ $total_saved -gt $((100 * 1024 * 1024)) ]; then
    echo -e "\n${YELLOW}Running git garbage collection...${NC}"
    git gc --aggressive --prune=now
fi