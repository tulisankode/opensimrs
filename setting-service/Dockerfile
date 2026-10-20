FROM node:25-alpine3.22

WORKDIR /app
COPY package.json .

# Application config
ENV APPLICATION_PORT=8094
ENV APPLICATION_HOST=0.0.0.0

# Dibangun dari root repo (lihat docker-compose.yml): SDK lokal di /packages, kode layanan di /app.
COPY packages /packages
COPY setting-service/ ./
# Panduan pengguna untuk kutipan Helpdesk (src/bantuan/panduan.js membaca ../docs/panduan-pengguna).
COPY docs/panduan-pengguna /docs/panduan-pengguna
RUN npm install
EXPOSE $APPLICATION_PORT/TCP
CMD ["npm", "run", "start"]
