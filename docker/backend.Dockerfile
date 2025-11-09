FROM node:20-alpine

WORKDIR /app

# Installa kubectl
RUN apk add --no-cache curl && \
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
    chmod +x kubectl && \
    mv kubectl /usr/local/bin/

# Copia dipendenze
COPY backend/package*.json ./
RUN npm install --production

# Copia codice
COPY backend/ ./

EXPOSE 3001 3002

CMD ["node", "server.js"]
