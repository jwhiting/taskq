#!/bin/bash

# Correct permissions on volume mounts that Docker creates as root

echo "Correcting volume mount permissions..."

# Fix .venv and node_modules directories
for dir_name in ".venv" "node_modules"; do
    find /workspace -type d -name "$dir_name" 2>/dev/null | while read -r dir_path; do
        if [ -d "$dir_path" ]; then
            echo "Fixing ownership of: $dir_path"
            chown -R node:node "$dir_path"
        fi
    done
done

echo "Volume mount permissions correction complete"
