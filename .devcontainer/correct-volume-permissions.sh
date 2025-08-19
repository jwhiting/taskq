#!/bin/bash

# Correct permissions on volume mounts that Docker creates as root

echo "Correcting volume mount permissions..."

# Fix .venv directories
find /workspace -type d -name ".venv" -exec ls -ld {} \; 2>/dev/null | while read -r line; do
    venv_path=$(echo "$line" | awk '{print $NF}')
    owner=$(echo "$line" | awk '{print $3}')
    
    if [ "$owner" != "node" ]; then
        echo "Fixing ownership of: $venv_path"
        chown -R node:node "$venv_path"
        echo "Fixed: $venv_path now owned by node:node"
    else
        echo "Already correct: $venv_path owned by node"
    fi
done

echo "Volume mount permissions correction complete"
