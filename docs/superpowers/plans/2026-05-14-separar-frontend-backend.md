# Separar Frontend y Backend en Carpetas Raíz — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover todo el código Next.js a una carpeta `frontend/` y la app Django vacía `core/` a `backend/core/`, dejando la raíz del proyecto solo con infraestructura compartida (docker-compose, docs, README).

**Architecture:** Se usa `git mv` para preservar historial de git. Los archivos auto-generados (`node_modules`, `.next`) se regeneran después del movimiento. El alias `@/` y las rutas de vitest/tsconfig son relativas al archivo de configuración — siguen funcionando sin cambios de contenido. Solo `docker-compose.yml` necesita actualización de rutas.

**Tech Stack:** Next.js 16, Django 5, Docker Compose, Vitest, TypeScript, PowerShell (Windows)

---

## Mapa de archivos

### Mueve a `frontend/`
| Origen (raíz) | Destino |
|---|---|
| `app/` | `frontend/app/` |
| `shared/` | `frontend/shared/` |
| `features/` | `frontend/features/` |
| `lib/` | `frontend/lib/` |
| `public/` | `frontend/public/` |
| `tests/` | `frontend/tests/` |
| `next.config.ts` | `frontend/next.config.ts` |
| `tsconfig.json` | `frontend/tsconfig.json` |
| `vitest.config.ts` | `frontend/vitest.config.ts` |
| `eslint.config.mjs` | `frontend/eslint.config.mjs` |
| `postcss.config.mjs` | `frontend/postcss.config.mjs` |
| `next-env.d.ts` | `frontend/next-env.d.ts` |
| `package.json` | `frontend/package.json` |
| `package-lock.json` | `frontend/package-lock.json` |
| `Dockerfile` | `frontend/Dockerfile` |

### Mueve a `backend/`
| Origen (raíz) | Destino |
|---|---|
| `core/` | `backend/core/` |

### Se queda en la raíz
- `docker-compose.yml` (actualizado)
- `backend/` (ya estaba)
- `docs/`, `Documentacion/`, `README.md`, `FASIL_CONNECTION_NOTES.md`, `skills-lock.json`

### Se regenera (no mover)
- `node_modules/` → eliminar en raíz, reinstalar en `frontend/`
- `.next/`, `tsconfig.tsbuildinfo` → se regeneran con el build

---

## Task 1: Mover código Next.js a frontend/

**Files:**
- Create dir: `frontend/`
- Move (git mv): todos los archivos listados en la tabla "Mueve a frontend/"
- Delete: `node_modules/` en raíz (reinstalar en `frontend/`)

- [ ] **Step 1: Crear directorio frontend/**

```powershell
New-Item -ItemType Directory -Force frontend
```

- [ ] **Step 2: Mover directorios y archivos con git mv**

```powershell
git mv app frontend/app
git mv shared frontend/shared
git mv features frontend/features
git mv lib frontend/lib
git mv public frontend/public
git mv tests frontend/tests
git mv next.config.ts frontend/next.config.ts
git mv tsconfig.json frontend/tsconfig.json
git mv vitest.config.ts frontend/vitest.config.ts
git mv eslint.config.mjs frontend/eslint.config.mjs
git mv postcss.config.mjs frontend/postcss.config.mjs
git mv next-env.d.ts frontend/next-env.d.ts
git mv package.json frontend/package.json
git mv package-lock.json frontend/package-lock.json
git mv Dockerfile frontend/Dockerfile
```

- [ ] **Step 3: Eliminar node_modules de la raíz**

`node_modules/` no está en git — se elimina directamente:

```powershell
Remove-Item -Recurse -Force node_modules
```

Si existe `.next/` en la raíz, eliminarlo también:

```powershell
if (Test-Path .next) { Remove-Item -Recurse -Force .next }
if (Test-Path tsconfig.tsbuildinfo) { Remove-Item -Force tsconfig.tsbuildinfo }
```

- [ ] **Step 4: Instalar dependencias dentro de frontend/**

```powershell
Set-Location frontend
npm install
```

Salida esperada: `added N packages` sin errores de módulo.

- [ ] **Step 5: Verificar que los tests pasan desde frontend/**

```powershell
npx vitest run
```

Salida esperada: `Test Files  12 passed (12)` y `Tests  36 passed (36)`.

Si algún test falla, es casi siempre un import roto. Buscar:

```powershell
Select-String -Recurse -Path "tests","app","shared","features","lib" -Pattern "@/components/" -Include "*.tsx","*.ts"
```

- [ ] **Step 6: Verificar build desde frontend/**

```powershell
npx next build
```

Salida esperada: build exitoso, sin `Module not found`.

- [ ] **Step 7: Volver a la raíz y hacer commit**

```powershell
Set-Location ..
git add -A
git commit -m "refactor: mover código Next.js a frontend/"
```

---

## Task 2: Mover core/ a backend/core/

**Files:**
- Move (git mv): `core/` → `backend/core/`
- No modificar contenido: `core/` está vacía y no está en INSTALLED_APPS

- [ ] **Step 1: Mover core/ con git mv**

```powershell
git mv core backend/core
```

- [ ] **Step 2: Verificar que apps.py es correcto**

Leer `backend/core/apps.py`. Debe tener:

```python
from django.apps import AppConfig


class CoreConfig(AppConfig):
    name = 'core'
```

El `name = 'core'` sigue siendo correcto porque Django resuelve apps desde el directorio donde vive `manage.py` (`backend/`), así que `backend/core/` se importa como `core`. No se necesita cambiar nada.

- [ ] **Step 3: Confirmar que core no está en INSTALLED_APPS**

```powershell
Select-String -Path "backend/config/settings.py" -Pattern "core"
```

Salida esperada: solo comentarios de logging, ninguna entrada en INSTALLED_APPS. Si aparece `'core'` o `'core.apps.CoreConfig'` en INSTALLED_APPS, ese es el string correcto — no cambiar nada.

- [ ] **Step 4: Commit**

```powershell
git add -A
git commit -m "refactor: mover app Django core/ a backend/core/"
```

---

## Task 3: Actualizar docker-compose.yml para nueva estructura

**Files:**
- Modify: `docker-compose.yml` (servicio `frontend`)

El servicio `frontend` actualmente apunta al build context `.` (raíz). Ahora debe apuntar a `./frontend`.

- [ ] **Step 1: Actualizar el bloque del servicio frontend en docker-compose.yml**

Buscar el bloque actual:

```yaml
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: labclinic_frontend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
      WATCHPACK_POLLING: "true"
    depends_on:
      - backend
    volumes:
      # Código fuente para hot-reload
      - .:/app
      # Volúmenes anónimos: preservan node_modules y .next del contenedor
      # (evitan que el montaje del host los sobreescriba)
      - /app/node_modules
      - /app/.next
      # Excluir el directorio backend del contexto del frontend
      - /app/backend
```

Reemplazarlo con:

```yaml
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: labclinic_frontend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
      WATCHPACK_POLLING: "true"
    depends_on:
      - backend
    volumes:
      - ./frontend:/app
      - /app/node_modules
      - /app/.next
```

Cambios realizados:
- `context: .` → `context: ./frontend`
- `- .:/app` → `- ./frontend:/app`
- Eliminado `- /app/backend` (ya no necesario: el contexto es `./frontend`, que no incluye backend)

- [ ] **Step 2: Commit**

```powershell
git add docker-compose.yml
git commit -m "refactor: actualizar docker-compose.yml para contexto frontend/"
```

---

## Task 4: Verificación final

**Files:** sin cambios de código.

- [ ] **Step 1: Verificar estructura raíz final**

```powershell
Get-ChildItem -Path . -Exclude node_modules,.git,venv | Select-Object Name
```

Salida esperada (solo estos elementos en la raíz):

```
backend/
docs/
Documentacion/
frontend/
docker-compose.yml
FASIL_CONNECTION_NOTES.md
README.md
resultados.log
skills-lock.json
```

`core/` NO debe aparecer en la raíz. `Dockerfile`, `package.json`, `next.config.ts`, etc. tampoco.

- [ ] **Step 2: Verificar estructura de frontend/**

```powershell
Get-ChildItem frontend/ | Select-Object Name
```

Salida esperada:

```
app/
features/
lib/
public/
shared/
tests/
node_modules/
Dockerfile
eslint.config.mjs
next.config.ts
next-env.d.ts
package.json
package-lock.json
postcss.config.mjs
tsconfig.json
vitest.config.ts
```

- [ ] **Step 3: Verificar estructura de backend/**

```powershell
Get-ChildItem backend/ | Select-Object Name
```

Salida esperada incluye `core/` junto a `chatbot/`, `config/`, `empresas/`, `resultados/`, `users/`.

- [ ] **Step 4: Ejecutar suite completa de tests desde frontend/**

```powershell
Set-Location frontend
npx vitest run
```

Salida esperada: `Test Files  12 passed (12)`, `Tests  36 passed (36)`.

- [ ] **Step 5: Ejecutar build de producción desde frontend/**

```powershell
npx next build
```

Salida esperada: build exitoso, 13+ rutas generadas, sin errores.

- [ ] **Step 6: Volver a raíz y commit final (si hubo fixes)**

```powershell
Set-Location ..
```

Si hubo algún fix menor durante la verificación:

```powershell
git add -A
git commit -m "fix: corregir rutas tras reorganización frontend/backend"
```

Si no hubo fixes, no es necesario un commit adicional.
