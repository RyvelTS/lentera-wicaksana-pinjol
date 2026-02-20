FROM node:24-alpine as build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Production runtime
FROM nginx:alpine

# Copy built Angular app from correct subdirectory
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create self-signed certificates for HTTPS
RUN apk add --no-cache openssl && \
    mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -newkey rsa:4096 -nodes -out /etc/nginx/ssl/cert.pem -keyout /etc/nginx/ssl/key.pem -days 365 -subj "/CN=localhost" && \
    apk del openssl

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
