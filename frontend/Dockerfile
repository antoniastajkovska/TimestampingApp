FROM node:20-alpine
WORKDIR /app

# Cache dependency layer — only re-runs npm ci if package*.json changes
COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
