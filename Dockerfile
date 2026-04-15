FROM node:24-slim

WORKDIR /app

COPY package*.json pnpm-lock.yaml* ./

RUN npm install

COPY . .

EXPOSE 5173 3000

CMD ["npm", "run", "dev"]
