FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV NEXT_PUBLIC_PROJECT_ID=691fbc12e3fb0774f75626d6
EXPOSE 80

# Add labels for project identification
LABEL org.opencontainers.image.project_id="691fbc12e3fb0774f75626d6"
LABEL org.opencontainers.image.component="web"

# Use next start to properly serve the application
CMD ["sh", "-c", "npx next start -p 80"]
