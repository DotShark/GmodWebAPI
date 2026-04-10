# Base
FROM node:20
WORKDIR /usr/src/app

# Project dependencies
COPY package*.json ./
RUN npm install

# Project files
COPY . .

# Service command
CMD ["node", "app.js"]