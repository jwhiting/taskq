#!/bin/bash

# Setup localdocker alias on macOS host
# The purpose of this is to allow the same hostname to work both on host and in containers to access services running in other docker containers on the host.

echo "Setting up localdocker alias on macOS host..."

# Check if localdocker already exists in /etc/hosts
if grep -q "localdocker" /etc/hosts; then
    echo "localdocker alias already exists in /etc/hosts"
    grep "localdocker" /etc/hosts
else
    echo "Adding localdocker -> 127.0.0.1 to /etc/hosts"
    echo "127.0.0.1 localdocker" | sudo tee -a /etc/hosts
    echo "Done! You can now use 'localdocker:8080' on both host and in containers."
fi

echo ""
echo "Usage:"
echo "  Host macOS:    curl http://localdocker:8080"
echo "  Container:     curl http://localdocker:8080"
echo "  Both point to your local Docker services!"