FROM node:25-alpine3.22
WORKDIR /app
# Dibangun dari root repo (lihat docker-compose.yml): SDK lokal di /packages, kode layanan di /app.
COPY packages /packages
COPY laporan-service/ ./
ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=8088
RUN npm install

EXPOSE ${SERVER_PORT}/tcp
CMD [ "npm", "run", "start:prod" ]