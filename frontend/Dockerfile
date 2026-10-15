# Build the client, then serve it with nginx, which also forwards /api to the assumptions service.

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=/api
ARG VITE_DEFAULT_CREATOR=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_DEFAULT_CREATOR=$VITE_DEFAULT_CREATOR

RUN npm run build


FROM nginx:1.27-alpine

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# The trailing slash strips the /api prefix, so /api/assumption reaches the service as /assumption.
ENV TRUTH_API_URL=http://truth-api:8000/
ENV NGINX_ENVSUBST_FILTER=TRUTH_API_URL

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
