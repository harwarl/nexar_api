FROM node:lts-alpine

# Set working directory
WORKDIR /app

# Copy only package files first to leverage Docker cache
COPY package*.json ./

# Install all dependencies, including devDependencies for build
RUN npm install

# Copy the full project
COPY . .

# Build the NestJS project (transpiles TypeScript to JS in dist/)
RUN npm run build

# Remove devDependencies after build to reduce image size
RUN npm prune --production

# Expose port
EXPOSE 3000

# Start production server
CMD ["npm", "run", "start:prod"]
