FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install -g pnpm
RUN cd frontend && pnpm install
RUN cd frontend && pnpm run build
