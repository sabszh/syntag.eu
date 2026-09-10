FROM node:24-alpine
WORKDIR /app
COPY server.mjs .
ENV PORT=8787 DATA_FILE=/data/usage.json
VOLUME ["/data"]
EXPOSE 8787
CMD ["node", "server.mjs"]
