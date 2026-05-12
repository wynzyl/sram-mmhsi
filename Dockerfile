# Use Node.js as the base image
FROM node:24-alpine

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm install

# Copy the rest of your code
COPY . .

# Expose the default Next.js port
EXPOSE 3000

# Run the development server
CMD ["npm", "run", "dev"]