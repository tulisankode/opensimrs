FROM node:25-alpine3.22
WORKDIR /app
# Dibangun dari root repo (lihat docker-compose.yml): SDK lokal di /packages, kode layanan di /app.
COPY packages /packages
COPY admisi-service/ ./
ENV APP_PORT=8081
ENV APP_HOST=0.0.0.0
RUN npm install
EXPOSE ${APP_PORT}/tcp
CMD ["npm", "run", "start"]
