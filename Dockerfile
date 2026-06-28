FROM node:20-alpine AS runtime

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund --no-package-lock --registry=https://registry.npmjs.org/

COPY src ./src
COPY mcp-server ./mcp-server
COPY agents ./agents
COPY graph ./graph

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "src/index.js", "--gui"]