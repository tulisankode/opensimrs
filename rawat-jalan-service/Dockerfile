FROM node:25-alpine3.22

WORKDIR /app
ENV APPLICATION_HOST=0.0.0.0
ENV APPLICATION_PORT=8092
# Dibangun dari root repo (lihat docker-compose.yml): SDK lokal di /packages, kode layanan di /app.
COPY packages /packages
COPY rawat-jalan-service/ ./
RUN npm install
EXPOSE $APPLICATION_PORT/tcp
CMD ["npm", "run", "start"]
