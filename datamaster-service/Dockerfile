FROM node:25-alpine3.22
LABEL application="Api Datamaster"
WORKDIR /app

# Application config
ENV APPLICATION_PORT=8086
ENV APPLICATION_HOST=0.0.0.0

# Dibangun dari root repo (lihat docker-compose.yml): SDK lokal di /packages, kode layanan di /app.
COPY packages /packages
COPY datamaster-service/ ./
RUN npm install
EXPOSE $APPLICATION_PORT/tcp
CMD ["npm", "run", "start"]