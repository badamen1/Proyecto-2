FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p media

EXPOSE 8000

# Ejecuta migraciones pendientes y luego inicia el servidor de desarrollo.
# Las variables de entorno vienen de docker-compose.yml (DB_HOST=db, etc.)
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py create_default_admin && python manage.py runserver 0.0.0.0:8000"]
