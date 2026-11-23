FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
# The Word letter templates are read at run time from ./templates (next to dist).
COPY --from=build /app/templates ./templates
# Run as the unprivileged "node" user that ships with the image, not root.
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
