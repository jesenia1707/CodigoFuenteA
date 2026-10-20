
FROM node:18-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci --omit=dev

# Copiar código de la aplicación
COPY src/ ./src/
COPY sql/ ./sql/

# Crear directorio de archivos y asignar permisos al usuario node
RUN mkdir -p uploads/contracts \
    && chown -R node:node /app

# Ejecutar la aplicación sin privilegios de root
USER node

# Exponer puerto
EXPOSE 4000

# Comando para iniciar la aplicación
CMD ["node", "src/app.js"]
