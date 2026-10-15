FROM node:25-alpine3.22
LABEL API="pembayaran API"
ENV APP_HOST=0.0.0.0
ENV APP_PORT=8089
WORKDIR /app
# Dibangun dari root repo (lihat docker-compose.yml): SDK lokal di /packages, kode layanan di /app.
COPY packages /packages
COPY payment-service/ ./
RUN npm install
EXPOSE $APP_PORT/tcp
CMD ["npm", "run", "start"]