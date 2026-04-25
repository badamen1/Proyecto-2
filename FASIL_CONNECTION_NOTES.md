# Notas de Configuración y Conexión a Base de Datos (FASIL & PostgreSQL)

Este documento recopila los hallazgos técnicos, problemas encontrados y soluciones aplicadas durante la configuración del entorno local (Windows) y la conexión al sistema externo FASIL (LIS).

## 1. Problema de `mysqlclient` en Windows
- **Síntoma**: Error de compilación al instalar dependencias (`pip install -r requirements.txt`) debido a la falta del archivo `mysql.h`.
- **Causa**: La librería `mysqlclient` requiere herramientas de compilación de C y headers de MySQL que no están instalados por defecto en entornos Windows.
- **Solución**: Se reemplazó `mysqlclient` por **`PyMySQL`** (una implementación 100% en Python). Para que Django reconozca este driver, se agregó el parche `pymysql.install_as_MySQLdb()` en `backend/config/__init__.py`.

## 2. PostgreSQL Local (UnicodeDecodeError y Autenticación)
- **Síntoma**: `UnicodeDecodeError: 'utf-8' codec can't decode byte...` al intentar ejecutar `python manage.py migrate`.
- **Causa**: En Windows, el locale por defecto suele ser español (Latin-1). Al ocurrir un error de conexión, PostgreSQL devolvía un mensaje de error con tildes (ej. "Contraseña..."), pero `psycopg2` intentaba decodificarlo obligatoriamente como UTF-8, provocando un crasheo antes de mostrar el error real.
- **Solución**:
  Se forzó a PostgreSQL a enviar los logs y mensajes de error en inglés (formato ASCII puro) ejecutando en `psql`:
  ```sql
  ALTER SYSTEM SET lc_messages = 'C';
  SELECT pg_reload_conf();
  ```
- **Error subyacente revelado**: Una vez resuelto el encoding, se descubrió un `FATAL: password authentication failed for user "postgres"`. Se resolvió igualando la contraseña de la BD con la del `.env` (`ALTER USER postgres WITH PASSWORD 'postgres';`).

## 3. Conexión a FASIL (MySQL 5.5 vs Django 5.x)
- **Síntoma**: Error `django.db.utils.NotSupportedError: MySQL 8.0.11 or later is required (found 5.5.56)`.
- **Causa**: El backend oficial de MySQL en las versiones recientes de Django (5.x) exige estrictamente conectarse a MySQL >= 8.0.11. Sin embargo, el servidor on-premise de FASIL ejecuta la versión heredada MySQL 5.5.56. Esto imposibilita registrar FASIL en `DATABASES['fasil']` dentro de `settings.py`.
- **Solución**:
  - Se eliminó la configuración de FASIL del diccionario `DATABASES` en `settings.py`.
  - En su lugar, se expusieron las variables del `.env` (`FASIL_DB_HOST`, `FASIL_DB_USER`, etc.) como atributos globales en `settings.py`.
  - En `fasil_service.py`, se implementó una conexión manual y directa utilizando `pymysql.connect(...)`. Esto permite consultar la base de datos evadiendo por completo la restricción de versión impuesta por el ORM de Django.

## 4. Esquema Real de la Base de Datos FASIL
Al lograr conectarse, se evidenció que la estructura real de la base de datos de producción difiere de las suposiciones iniciales. Los cambios clave mapeados en el código son:
- **Nombre de Base de Datos**: Es `bioanalisis30` (NO `bioanalisis272`).
- **Tabla de Pacientes (`pct_pacientes`)**:
  - Nombres: `nomPaciente` y `apePaciente` (NO `nombres` y `apellidos`).
- **Tabla de Documentos**:
  - Se llama `gnr_documentos` (NO `tipo_doc`).
  - La abreviatura del documento está en `codDocumento` (ej. 'CC').
- **Tabla de Órdenes (`svc_ordenes`)**:
  - La columna de fecha es `fecha` (NO `fechaOrden`).
  - El "tipo de examen" no está en esta tabla; requiere una subconsulta uniendo `svc_detordenes` y `prb_prb`.
- **Tabla de Resultados**:
  - Los archivos PDF en formato BLOB se encuentran en la tabla `svc_result` bajo la columna `archivo` (NO en la tabla `resultado`).

## 5. Comandos Útiles de Depuración
**Para verificar la conexión a FASIL por fuera de Django:**
```python
python -c "import pymysql; conn = pymysql.connect(host='192.168.1.109', port=3306, db='bioanalisis30', user='fasil2', password='f4s1l2', charset='utf8mb4'); cur = conn.cursor(); cur.execute('SHOW TABLES'); [print(r[0]) for r in cur.fetchall()]; conn.close()"
```

**Para probar el Servicio FASIL dentro del contexto de Django:**
```bash
python manage.py shell
```
```python
from resultados.services.fasil_service import fasil_service

# Verificar conectividad y configuración
print(fasil_service.ping())

# Buscar un paciente real
paciente = fasil_service.get_paciente('NUMERO_DOCUMENTO')
print(paciente)
```
