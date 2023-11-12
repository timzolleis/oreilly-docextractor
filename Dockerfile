FROM node:latest

# Copy all necessary files to the container
COPY packages /app/packages
COPY package.json /app/package.json

# Install all dependencies
WORKDIR /app
RUN npm install

# Build the CLI package
RUN npm run build -w packages/cli

# Build the EXTRACTOR package
RUN npm run build -w packages/extractor