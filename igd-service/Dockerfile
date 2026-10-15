FROM node:25-alpine3.22

WORKDIR /app
LABEL application="admisi service"
ENV APPLICATION_PORT=8085
ENV APPLICATION_HOST=0.0.0.0
# Dibangun dari root repo (lihat docker-compose.yml): SDK lokal di /packages, kode layanan di /app.
COPY packages /packages
COPY igd-service/ ./
RUN npm install
CMD ["npm", "run", "start"]
