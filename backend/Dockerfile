FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Ensure data directories exist
RUN mkdir -p data/sessions logs

EXPOSE 3001

CMD ["npm", "start"]
