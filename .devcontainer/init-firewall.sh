#!/bin/bash
set -euo pipefail  # Exit on error, undefined vars, and pipeline failures
IFS=$'\n\t'       # Stricter word splitting

# Flush existing rules and delete existing ipsets
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X
ipset destroy allowed-domains 2>/dev/null || true

# First allow DNS and localhost before any restrictions
# Allow outbound DNS
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
# Allow inbound DNS responses
iptables -A INPUT -p udp --sport 53 -j ACCEPT
# Allow outbound SSH
iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT
# Allow inbound SSH responses
iptables -A INPUT -p tcp --sport 22 -m state --state ESTABLISHED -j ACCEPT
# Allow localhost
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Create ipset with CIDR support
ipset create allowed-domains hash:net

# Allow access to Docker host gateway (for accessing host services like NocoDB)
echo "Adding Docker host gateway access..."
# Get IPv4 address specifically using dig
host_gateway_ip=$(dig +short host.docker.internal A | head -1)
if [[ "$host_gateway_ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    echo "Adding host gateway IPv4: $host_gateway_ip"
    ipset add allowed-domains "$host_gateway_ip" 2>/dev/null || echo "Host gateway IP already exists"
    
    # Add localdocker alias to /etc/hosts
    echo "Setting up localdocker alias..."
    if ! grep -q "localdocker" /etc/hosts; then
        echo "$host_gateway_ip localdocker" >> /etc/hosts
        echo "Added localdocker -> $host_gateway_ip to /etc/hosts"
    else
        echo "localdocker alias already exists in /etc/hosts"
    fi
else
    echo "WARNING: Could not resolve host.docker.internal IPv4, trying common Docker Desktop IPs"
    # Common Docker Desktop host gateway IPs
    for ip in "192.168.65.254" "192.168.65.1" "172.17.0.1"; do
        echo "Adding fallback host IP: $ip"
        ipset add allowed-domains "$ip" 2>/dev/null || echo "IP $ip already exists"
    done
    # Use first fallback IP for localdocker alias
    if ! grep -q "localdocker" /etc/hosts; then
        echo "192.168.65.254 localdocker" >> /etc/hosts
        echo "Added fallback localdocker alias"
    fi
fi

# Fetch GitHub meta information and aggregate + add their IP ranges
echo "Fetching GitHub IP ranges..."
gh_ranges=$(curl -s https://api.github.com/meta)
if [ -z "$gh_ranges" ]; then
    echo "ERROR: Failed to fetch GitHub IP ranges"
    exit 1
fi

if ! echo "$gh_ranges" | jq -e '.web and .api and .git' >/dev/null; then
    echo "ERROR: GitHub API response missing required fields"
    exit 1
fi

echo "Processing GitHub IPs..."
while read -r cidr; do
    if [[ ! "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
        echo "WARNING: Skipping invalid CIDR: $cidr"
        continue
    fi
    echo "Adding GitHub CIDR: $cidr"
    ipset add allowed-domains "$cidr"
done < <(echo "$gh_ranges" | jq -r '.web[],.api[],.git[]' | aggregate)

# Add Claude API endpoints
echo "Adding Claude API endpoints..."
claude_domains=("api.anthropic.com" "claude.ai")
for domain in "${claude_domains[@]}"; do
    echo "Resolving $domain..."
    domain_ips=$(dig +short "$domain" A | grep -E '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$' || true)
    if [ -n "$domain_ips" ]; then
        while read -r ip; do
            if [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
                echo "Adding Claude IP: $ip"
                ipset add allowed-domains "$ip" 2>/dev/null || echo "IP $ip already exists"
            fi
        done <<< "$domain_ips"
    else
        echo "WARNING: Could not resolve $domain"
    fi
done

# Add npm registry
echo "Adding npm registry..."
npm_domains=("registry.npmjs.org" "npm.org" "npmjs.com" "repo.yarnpkg.com")
for domain in "${npm_domains[@]}"; do
    echo "Resolving $domain..."
    domain_ips=$(dig +short "$domain" A | grep -E '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$' || true)
    if [ -n "$domain_ips" ]; then
        while read -r ip; do
            if [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
                echo "Adding npm IP: $ip"
                ipset add allowed-domains "$ip" 2>/dev/null || echo "IP $ip already exists"
            fi
        done <<< "$domain_ips"
    fi
done

# Add PyPI
echo "Adding PyPI..."
pypi_domains=("pypi.org" "pypi.python.org" "files.pythonhosted.org")
for domain in "${pypi_domains[@]}"; do
    echo "Resolving $domain..."
    domain_ips=$(dig +short "$domain" A | grep -E '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$' || true)
    if [ -n "$domain_ips" ]; then
        while read -r ip; do
            if [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
                echo "Adding PyPI IP: $ip"
                ipset add allowed-domains "$ip" 2>/dev/null || echo "IP $ip already exists"
            fi
        done <<< "$domain_ips"
    fi
done

# Add project-specific allowed domains if specified
if [ -n "${ALLOWED_DOMAINS:-}" ]; then
    echo "Adding project-specific allowed domains..."
    IFS=',' read -ra DOMAIN_ARRAY <<< "$ALLOWED_DOMAINS"
    for domain in "${DOMAIN_ARRAY[@]}"; do
        # Trim whitespace
        domain=$(echo "$domain" | xargs)
        echo "Resolving project domain: $domain..."
        domain_ips=$(dig +short "$domain" A | grep -E '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$' || true)
        if [ -n "$domain_ips" ]; then
            while read -r ip; do
                if [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
                    echo "Adding project domain IP: $ip ($domain)"
                    ipset add allowed-domains "$ip" 2>/dev/null || echo "IP $ip already exists"
                fi
            done <<< "$domain_ips"
        else
            echo "WARNING: Could not resolve project domain: $domain"
        fi
    done
fi

# Allow outbound traffic to allowed domains
iptables -A OUTPUT -p tcp -m set --match-set allowed-domains dst -j ACCEPT
iptables -A INPUT -p tcp -m set --match-set allowed-domains src -m state --state ESTABLISHED -j ACCEPT

# Block all other outbound traffic
iptables -A OUTPUT -p tcp -j REJECT --reject-with tcp-reset
iptables -A OUTPUT -p udp -j REJECT --reject-with icmp-port-unreachable

echo "Firewall rules applied successfully!"
echo "Allowed domains configured from environment variable: ${ALLOWED_DOMAINS:-none}"