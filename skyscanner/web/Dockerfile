FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY libraries/ui/package.json ./libraries/ui/package.json
COPY libraries/grid/package.json ./libraries/grid/package.json
COPY skyscanner/web/package.json ./skyscanner/web/package.json
COPY truth/web/package.json ./truth/web/package.json

RUN npm ci

COPY libraries/ui ./libraries/ui
COPY libraries/grid ./libraries/grid
COPY skyscanner/web ./skyscanner/web

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Where the coordinate field draws its map from. The system runs behind a firewall, so no tile server is
# assumed: without one the field still takes a point, typed in as three numbers.
ARG VITE_MAP_TILE_URL=
ENV VITE_MAP_TILE_URL=$VITE_MAP_TILE_URL
ARG VITE_MAP_ATTRIBUTION=
ENV VITE_MAP_ATTRIBUTION=$VITE_MAP_ATTRIBUTION

RUN npm run build --workspace @truth-platform/skyscanner-web

FROM nginx:1.27-alpine

COPY skyscanner/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/skyscanner/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
