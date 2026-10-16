FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY src ./src
ENV APPLICATION_HOST=0.0.0.0
ENV APPLICATION_PORT=8100
EXPOSE 8100/tcp
CMD ["node", "src/server.js"]
