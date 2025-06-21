FROM node:lts-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy only the compiled JS and any assets needed at runtime
COPY dist ./dist

EXPOSE 3000

CMD ["npm", "run", "start:prod"]