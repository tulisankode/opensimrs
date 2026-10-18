FROM node:22-alpine
WORKDIR /app
# Dibangun dari root repo (lihat docker-compose.yml). Hanya fungsi murni audit-core.js dari SDK lokal yang dipakai
# (audit_trail pusat HR / SDM, src/hr/audit.js mengimpor ../../../packages/model-sdk/umum/audit-core.js → /packages/...).
COPY penunjang-service/package.json penunjang-service/package-lock.json ./
RUN npm ci --omit=dev
# package.json ikut disalin agar berkas .js SDK dibaca sebagai modul ES ("type": "module").
COPY packages/model-sdk/package.json /packages/model-sdk/package.json
COPY packages/model-sdk/umum/audit-core.js /packages/model-sdk/umum/audit-core.js
COPY penunjang-service/src ./src
ENV APPLICATION_HOST=0.0.0.0
ENV APPLICATION_PORT=8099
EXPOSE 8099/tcp
CMD ["node", "src/server.js"]
