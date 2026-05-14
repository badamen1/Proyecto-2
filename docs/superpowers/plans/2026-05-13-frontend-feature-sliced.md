# Frontend Feature-Sliced Reorganization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar el frontend de Next.js con arquitectura feature-sliced moderada, moviendo componentes desde la carpeta plana `components/` a `shared/` y `features/`, y reorganizando `tests/` para reflejar la nueva estructura.

**Architecture:** La carpeta `components/` desaparece y es reemplazada por `shared/` (componentes sin dominio: layout y UI genérica) y `features/` (dominios con lógica propia: auth, chatbot, resultados, dashboard). La carpeta `app/` no cambia de estructura; solo se actualizan sus imports. Los tests se mueven a subdirectorios equivalentes dentro de `tests/`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Vitest, React Testing Library

---

## Mapa de archivos

| Origen | Destino |
|---|---|
| `components/Navbar.tsx` | `shared/layout/Navbar.tsx` |
| `components/Footer.tsx` | `shared/layout/Footer.tsx` |
| `components/FloatingButtons.tsx` | `shared/ui/FloatingButtons.tsx` |
| `components/FeatureCard.tsx` | `shared/ui/FeatureCard.tsx` |
| `components/ServiceCard.tsx` | `shared/ui/ServiceCard.tsx` |
| `components/ChatbotWidget.tsx` | `features/chatbot/components/ChatbotWidget.tsx` |
| `tests/Navbar.test.tsx` | `tests/shared/Navbar.test.tsx` |
| `tests/FloatingButtons.test.tsx` | `tests/shared/FloatingButtons.test.tsx` |
| `tests/ServiceCard.test.tsx` | `tests/shared/ServiceCard.test.tsx` |
| `tests/login-page.test.tsx` | `tests/features/auth/login-page.test.tsx` |
| `tests/register-page.test.tsx` | `tests/features/auth/register-page.test.tsx` |
| `tests/dashboard-page.test.tsx` | `tests/features/dashboard/dashboard-page.test.tsx` |
| `tests/app/dashboard/resultados-list.test.tsx` | `tests/features/dashboard/resultados-list.test.tsx` |
| `tests/app/dashboard/resultados-detail.test.tsx` | `tests/features/dashboard/resultados-detail.test.tsx` |

**Imports que cambian:**

| Archivo | Viejo import | Nuevo import |
|---|---|---|
| `app/layout.tsx` | `@/components/Navbar` | `@/shared/layout/Navbar` |
| `app/layout.tsx` | `@/components/Footer` | `@/shared/layout/Footer` |
| `app/layout.tsx` | `@/components/FloatingButtons` | `@/shared/ui/FloatingButtons` |
| `app/layout.tsx` | `@/components/ChatbotWidget` | `@/features/chatbot/components/ChatbotWidget` |
| `app/page.tsx` | `@/components/FeatureCard` | `@/shared/ui/FeatureCard` |
| `app/servicios/page.tsx` | `@/components/ServiceCard` | `@/shared/ui/ServiceCard` |
| `tests/shared/Navbar.test.tsx` | `@/components/Navbar` | `@/shared/layout/Navbar` |
| `tests/shared/FloatingButtons.test.tsx` | `@/components/FloatingButtons` | `@/shared/ui/FloatingButtons` |
| `tests/shared/ServiceCard.test.tsx` | `@/components/ServiceCard` | `@/shared/ui/ServiceCard` |

---

## Task 1: Mover Navbar y Footer → shared/layout/

**Files:**
- Create: `shared/layout/Navbar.tsx`
- Create: `shared/layout/Footer.tsx`
- Modify: `app/layout.tsx`
- Create: `tests/shared/Navbar.test.tsx`
- Delete: `components/Navbar.tsx`, `components/Footer.tsx`, `tests/Navbar.test.tsx`

- [ ] **Step 1: Crear directorios shared/**

```powershell
New-Item -ItemType Directory -Force shared/layout
New-Item -ItemType Directory -Force shared/ui
```

- [ ] **Step 2: Mover Navbar.tsx**

```powershell
Move-Item components/Navbar.tsx shared/layout/Navbar.tsx
```

- [ ] **Step 3: Mover Footer.tsx**

```powershell
Move-Item components/Footer.tsx shared/layout/Footer.tsx
```

- [ ] **Step 4: Actualizar imports en app/layout.tsx**

Cambiar las dos primeras líneas de import de componentes:

```tsx
// Antes:
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingButtons from "@/components/FloatingButtons";
import ChatbotWidget from "@/components/ChatbotWidget";

// Después (solo Navbar y Footer por ahora — el resto en Task 2 y 3):
import Navbar from "@/shared/layout/Navbar";
import Footer from "@/shared/layout/Footer";
import FloatingButtons from "@/components/FloatingButtons";
import ChatbotWidget from "@/components/ChatbotWidget";
```

- [ ] **Step 5: Mover test de Navbar a tests/shared/**

```powershell
New-Item -ItemType Directory -Force tests/shared
Move-Item tests/Navbar.test.tsx tests/shared/Navbar.test.tsx
```

- [ ] **Step 6: Actualizar import en tests/shared/Navbar.test.tsx**

Editar la primera línea del archivo:

```ts
// Antes:
import Navbar from "@/components/Navbar";

// Después:
import Navbar from "@/shared/layout/Navbar";
```

- [ ] **Step 7: Ejecutar tests para verificar que Navbar.test.tsx pasa**

```powershell
npx vitest run tests/shared/Navbar.test.tsx
```

Salida esperada: `✓ tests/shared/Navbar.test.tsx (3 tests)` — sin fallos.

- [ ] **Step 8: Commit**

```powershell
git add shared/layout/Navbar.tsx shared/layout/Footer.tsx app/layout.tsx tests/shared/Navbar.test.tsx
git commit -m "refactor: mover Navbar y Footer a shared/layout/"
```

---

## Task 2: Mover FeatureCard, ServiceCard, FloatingButtons → shared/ui/

**Files:**
- Create: `shared/ui/FeatureCard.tsx`
- Create: `shared/ui/ServiceCard.tsx`
- Create: `shared/ui/FloatingButtons.tsx`
- Modify: `app/layout.tsx` (import FloatingButtons)
- Modify: `app/page.tsx` (import FeatureCard)
- Modify: `app/servicios/page.tsx` (import ServiceCard)
- Create: `tests/shared/FloatingButtons.test.tsx`
- Create: `tests/shared/ServiceCard.test.tsx`
- Delete: `components/FeatureCard.tsx`, `components/ServiceCard.tsx`, `components/FloatingButtons.tsx`
- Delete: `tests/FloatingButtons.test.tsx`, `tests/ServiceCard.test.tsx`

- [ ] **Step 1: Mover los tres componentes**

```powershell
Move-Item components/FeatureCard.tsx shared/ui/FeatureCard.tsx
Move-Item components/ServiceCard.tsx shared/ui/ServiceCard.tsx
Move-Item components/FloatingButtons.tsx shared/ui/FloatingButtons.tsx
```

- [ ] **Step 2: Actualizar import FloatingButtons en app/layout.tsx**

```tsx
// Antes:
import FloatingButtons from "@/components/FloatingButtons";

// Después:
import FloatingButtons from "@/shared/ui/FloatingButtons";
```

El archivo `app/layout.tsx` completo de imports después de Task 1 y este step debe quedar:

```tsx
import Navbar from "@/shared/layout/Navbar";
import Footer from "@/shared/layout/Footer";
import FloatingButtons from "@/shared/ui/FloatingButtons";
import ChatbotWidget from "@/components/ChatbotWidget";
```

- [ ] **Step 3: Actualizar import FeatureCard en app/page.tsx**

```tsx
// Antes:
import FeatureCard from '@/components/FeatureCard';

// Después:
import FeatureCard from '@/shared/ui/FeatureCard';
```

- [ ] **Step 4: Actualizar import ServiceCard en app/servicios/page.tsx**

```tsx
// Antes:
import ServiceCard from '@/components/ServiceCard';

// Después:
import ServiceCard from '@/shared/ui/ServiceCard';
```

- [ ] **Step 5: Mover tests y actualizar sus imports**

```powershell
Move-Item tests/FloatingButtons.test.tsx tests/shared/FloatingButtons.test.tsx
Move-Item tests/ServiceCard.test.tsx tests/shared/ServiceCard.test.tsx
```

Editar `tests/shared/FloatingButtons.test.tsx`, primera línea:

```ts
// Antes:
import FloatingButtons from "@/components/FloatingButtons";

// Después:
import FloatingButtons from "@/shared/ui/FloatingButtons";
```

Editar `tests/shared/ServiceCard.test.tsx`, primera línea:

```ts
// Antes:
import ServiceCard from "@/components/ServiceCard";

// Después:
import ServiceCard from "@/shared/ui/ServiceCard";
```

- [ ] **Step 6: Ejecutar tests de shared/**

```powershell
npx vitest run tests/shared/
```

Salida esperada: `✓ tests/shared/Navbar.test.tsx (3)  ✓ tests/shared/FloatingButtons.test.tsx (2)  ✓ tests/shared/ServiceCard.test.tsx (1)` — sin fallos.

- [ ] **Step 7: Commit**

```powershell
git add shared/ui/ app/layout.tsx app/page.tsx app/servicios/page.tsx tests/shared/FloatingButtons.test.tsx tests/shared/ServiceCard.test.tsx
git commit -m "refactor: mover FeatureCard, ServiceCard, FloatingButtons a shared/ui/"
```

---

## Task 3: Mover ChatbotWidget → features/chatbot/components/

**Files:**
- Create: `features/chatbot/components/ChatbotWidget.tsx`
- Modify: `app/layout.tsx` (import ChatbotWidget)
- Delete: `components/ChatbotWidget.tsx`

- [ ] **Step 1: Crear directorio features/chatbot/components/**

```powershell
New-Item -ItemType Directory -Force features/chatbot/components
New-Item -ItemType Directory -Force features/auth/components
New-Item -ItemType Directory -Force features/resultados/components
New-Item -ItemType Directory -Force features/dashboard/components
```

(Se crean todos los directorios de features en un paso para no repetirlo después.)

- [ ] **Step 2: Mover ChatbotWidget**

```powershell
Move-Item components/ChatbotWidget.tsx features/chatbot/components/ChatbotWidget.tsx
```

- [ ] **Step 3: Actualizar import en app/layout.tsx**

```tsx
// Antes:
import ChatbotWidget from "@/components/ChatbotWidget";

// Después:
import ChatbotWidget from "@/features/chatbot/components/ChatbotWidget";
```

El archivo `app/layout.tsx` completo de imports queda:

```tsx
import Navbar from "@/shared/layout/Navbar";
import Footer from "@/shared/layout/Footer";
import FloatingButtons from "@/shared/ui/FloatingButtons";
import ChatbotWidget from "@/features/chatbot/components/ChatbotWidget";
```

- [ ] **Step 4: Verificar que components/ está vacío**

```powershell
Get-ChildItem components/
```

Salida esperada: directorio vacío (sin archivos listados).

- [ ] **Step 5: Eliminar components/**

```powershell
Remove-Item -Recurse -Force components/
```

- [ ] **Step 6: Ejecutar suite completa de tests**

```powershell
npx vitest run
```

Salida esperada: todos los tests pasan sin errores. Si algún test falla con `Cannot find module '@/components/...'`, ese archivo de test aún tiene el import viejo — actualízalo con la nueva ruta antes de continuar.

- [ ] **Step 7: Commit**

```powershell
git add features/chatbot/components/ChatbotWidget.tsx features/auth/ features/resultados/ features/dashboard/ app/layout.tsx
git commit -m "refactor: mover ChatbotWidget a features/chatbot/ y crear estructura features/"
```

---

## Task 4: Reorganizar tests de auth → tests/features/auth/

**Files:**
- Create: `tests/features/auth/login-page.test.tsx`
- Create: `tests/features/auth/register-page.test.tsx`
- Delete: `tests/login-page.test.tsx`, `tests/register-page.test.tsx`

> Nota: estos tests importan desde `@/app/login/page` y `@/app/register/page`, que no se mueven. No hay cambios de imports.

- [ ] **Step 1: Crear directorio tests/features/auth/**

```powershell
New-Item -ItemType Directory -Force tests/features/auth
New-Item -ItemType Directory -Force tests/features/dashboard
New-Item -ItemType Directory -Force tests/features/resultados
```

- [ ] **Step 2: Mover tests de auth**

```powershell
Move-Item tests/login-page.test.tsx tests/features/auth/login-page.test.tsx
Move-Item tests/register-page.test.tsx tests/features/auth/register-page.test.tsx
```

- [ ] **Step 3: Ejecutar tests de auth/**

```powershell
npx vitest run tests/features/auth/
```

Salida esperada: `✓ tests/features/auth/login-page.test.tsx (3)  ✓ tests/features/auth/register-page.test.tsx (1)` — sin fallos.

- [ ] **Step 4: Commit**

```powershell
git add tests/features/auth/
git commit -m "refactor: mover tests de auth a tests/features/auth/"
```

---

## Task 5: Reorganizar tests de dashboard/resultados → tests/features/dashboard/

**Files:**
- Create: `tests/features/dashboard/dashboard-page.test.tsx`
- Create: `tests/features/dashboard/resultados-list.test.tsx`
- Create: `tests/features/dashboard/resultados-detail.test.tsx`
- Delete: `tests/dashboard-page.test.tsx`, `tests/app/dashboard/` (directorio completo)

> Nota: estos tests importan desde `@/app/dashboard/page` y hacen `await import('@/app/dashboard/resultados/...')`. Ninguno importa desde `components/`. No hay cambios de imports.

- [ ] **Step 1: Mover tests de dashboard**

```powershell
Move-Item tests/dashboard-page.test.tsx tests/features/dashboard/dashboard-page.test.tsx
Move-Item tests/app/dashboard/resultados-list.test.tsx tests/features/dashboard/resultados-list.test.tsx
Move-Item tests/app/dashboard/resultados-detail.test.tsx tests/features/dashboard/resultados-detail.test.tsx
```

- [ ] **Step 2: Eliminar directorio tests/app/ (ya vacío)**

```powershell
Remove-Item -Recurse -Force tests/app/
```

- [ ] **Step 3: Ejecutar tests de dashboard/**

```powershell
npx vitest run tests/features/dashboard/
```

Salida esperada: `✓ dashboard-page.test.tsx (5)  ✓ resultados-list.test.tsx (6)  ✓ resultados-detail.test.tsx (2)` — sin fallos.

- [ ] **Step 4: Commit**

```powershell
git add tests/features/dashboard/
git commit -m "refactor: mover tests de dashboard a tests/features/dashboard/"
```

---

## Task 6: Verificación final y limpieza

**Files:** sin cambios de código — solo verificación.

- [ ] **Step 1: Ejecutar suite completa de tests**

```powershell
npx vitest run
```

Salida esperada: todos los tests pasan. Ejemplo:

```
✓ tests/shared/Navbar.test.tsx (3)
✓ tests/shared/FloatingButtons.test.tsx (2)
✓ tests/shared/ServiceCard.test.tsx (1)
✓ tests/features/auth/login-page.test.tsx (3)
✓ tests/features/auth/register-page.test.tsx (1)
✓ tests/features/dashboard/dashboard-page.test.tsx (5)
✓ tests/features/dashboard/resultados-list.test.tsx (6)
✓ tests/features/dashboard/resultados-detail.test.tsx (2)
✓ tests/lib/api.test.ts (...)
...
Test Files  X passed
```

Si algún test falla, revisar el mensaje de error — casi siempre será un import que apunta a `@/components/` que quedó sin actualizar. Buscar con:

```powershell
Select-String -Path "tests/**/*.test.tsx" -Pattern "@/components/" -Recurse
```

Actualizar el import encontrado a su nueva ruta en `@/shared/` o `@/features/` según corresponda.

- [ ] **Step 2: Ejecutar build de producción**

```powershell
npx next build
```

Salida esperada: build exitoso sin errores de módulo no encontrado.

Si el build falla con `Module not found: Can't resolve '@/components/...'`, buscar el archivo que aún usa el import viejo:

```powershell
Select-String -Path "app/**/*.tsx" -Pattern "@/components/" -Recurse
```

Actualizar ese import y re-ejecutar el build.

- [ ] **Step 3: Verificar estructura final**

```powershell
Get-ChildItem shared/ -Recurse | Where-Object { -not $_.PSIsContainer }
Get-ChildItem features/ -Recurse | Where-Object { -not $_.PSIsContainer }
```

Salida esperada:

```
shared/layout/Navbar.tsx
shared/layout/Footer.tsx
shared/ui/FeatureCard.tsx
shared/ui/FloatingButtons.tsx
shared/ui/ServiceCard.tsx
features/chatbot/components/ChatbotWidget.tsx
```

Y `components/` NO debe existir:

```powershell
Test-Path components/
```

Salida esperada: `False`

- [ ] **Step 4: Commit final**

```powershell
git add -A
git commit -m "refactor: verificación final — reorganización feature-sliced completada"
```
