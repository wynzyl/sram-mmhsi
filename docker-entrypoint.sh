#!/bin/sh
set -e

# Fix ownership of uploads directory (volume mount overrides Dockerfile permissions)
# This runs as root before dropping to nextjs user
if [ -d "/app/public/uploads" ]; then
  chown -R nextjs:nextjs /app/public/uploads
fi

# Drop privileges and execute the main command as nextjs user
exec su-exec nextjs "$@"
