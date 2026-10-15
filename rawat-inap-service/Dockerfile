FROM node:25-alpine3.22

WORKDIR /app
LABEL application="rawat inap service"
ENV APP_PORT=8091
ENV APP_HOST=0.0.0.0
# Dibangun dari root repo (lihat docker-compose.yml): SDK lokal di /packages, kode layanan di /app.
COPY packages /packages
COPY rawat-inap-service/ ./
RUN npm install
CMD ["npm", "run", "start"]
