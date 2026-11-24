FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
# The Word letter templates are read at run time from ./templates (next to dist).
COPY --from=build /app/templates ./templates
# Install a supported Chromium build and its system libraries for the Maersk UI tracker.
RUN npx playwright install --with-deps chromium \
  && chmod -R 755 /ms-playwright
# Run as the unprivileged "node" user that ships with the image, not root.
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
