# Pure static website: no application runtime, database, or backend API.
# The upstream unprivileged image listens on port 8080.
FROM nginx/nginx-unprivileged:stable-alpine

COPY --chown=101:101 dist/ /usr/share/nginx/html/

EXPOSE 8080
