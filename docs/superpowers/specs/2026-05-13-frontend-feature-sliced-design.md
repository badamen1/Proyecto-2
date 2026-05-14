# Diseño: Reorganización Frontend por Feature-Sliced (Moderado)

**Fecha:** 2026-05-13
**Alcance:** Solo frontend (Next.js) — sin tocar el backend Django
**Modelo elegido:** Feature-Sliced moderado — solo los dominios con lógica real obtienen un feature module

---

## Motivación

La carpeta `components/` actual mezcla componentes de layout (Navbar, Footer), UI genérica (FeatureCard, ServiceCard) y lógica de dominio (ChatbotWidget) en un mismo nivel plano. La carpeta `lib/` solo contiene un API client y tipos globales. No existe separación por dominio. A medida que el proyecto crece, esta estructura dificulta localizar código y entender responsabilidades.

---

## Estructura Final

```
labclinic-nextjs/
├── app/                              ← routing Next.js (sin cambios salvo imports)
│   ├── agendar-muestra/              ← sin cambios
│   ├── agenda-tu-cita/               ← sin cambios
│   ├── contacto/                     ← sin cambios
│   ├── dashboard/
│   │   ├── resultados/[id]/          ← página importa desde features/resultados
│   │   └── usuarios/                 ← página importa desde features/dashboard
│   ├── login/                        ← página importa desde features/auth
│   ├── nosotros/                     ← sin cambios
│   ├── register/                     ← página importa desde features/auth
│   ├── servicios/                    ← sin cambios
│   ├── globals.css
│   ├── layout.tsx                    ← imports actualizados a shared/
│   └── page.tsx                      ← sin cambios
│
├── features/                         ← NUEVO
│   ├── auth/
│   │   ├── components/               ← LoginForm, RegisterForm (por extraer de pages)
│   │   └── types.ts                  ← tipos de usuario/auth
│   ├── resultados/
│   │   ├── components/               ← ResultadosList, ResultadoDetail (por extraer)
│   │   └── types.ts                  ← tipos de resultados FASIL
│   ├── dashboard/
│   │   └── components/               ← UserTable u otros (por extraer)
│   └── chatbot/
│       └── components/
│           └── ChatbotWidget.tsx     ← MOVIDO desde components/
│
├── shared/                           ← NUEVO (reemplaza components/)
│   ├── layout/
│   │   ├── Navbar.tsx                ← MOVIDO desde components/
│   │   └── Footer.tsx                ← MOVIDO desde components/
│   └── ui/
│       ├── FeatureCard.tsx           ← MOVIDO desde components/
│       ├── FloatingButtons.tsx       ← MOVIDO desde components/
│       └── ServiceCard.tsx           ← MOVIDO desde components/
│
├── lib/                              ← sin cambios
│   ├── api.ts
│   └── types.ts
│
└── tests/                            ← reorganizados, sin reescribir lógica
    ├── features/
    │   ├── auth/
    │   │   ├── login-page.test.tsx   ← MOVIDO
    │   │   └── register-page.test.tsx ← MOVIDO
    │   ├── dashboard/
    │   │   ├── dashboard-page.test.tsx ← MOVIDO
    │   │   └── (contenido de tests/app/dashboard/) ← MOVIDO
    │   └── resultados/               ← vacío por ahora
    ├── shared/
    │   ├── Navbar.test.tsx           ← MOVIDO
    │   ├── FloatingButtons.test.tsx  ← MOVIDO
    │   └── ServiceCard.test.tsx      ← MOVIDO
    ├── lib/
    │   └── api.test.ts               ← sin cambios
    ├── agendar-muestra-page.test.tsx ← sin mover (página sin feature module)
    ├── contacto-page.test.tsx        ← sin mover
    ├── servicios-page.test.tsx       ← sin mover
    └── setup.tsx                     ← sin cambios
```

---

## Reglas de la arquitectura

1. **`app/` es solo routing.** Las páginas en `app/` deben ser lo más delgadas posible: importan componentes desde `features/` o `shared/`, sin lógica propia.
2. **`features/` solo para dominios con lógica.** No crear un feature module para páginas puramente informativas (nosotros, contacto, servicios).
3. **`shared/` para código sin dominio.** Navbar, Footer, y componentes UI genéricos que se usan en múltiples features.
4. **`lib/` para utilidades puras.** El API client y los tipos globales se mantienen aquí.
5. **Los imports usan `@/`.** El alias `@/*` del `tsconfig.json` cubre todas las carpetas raíz, evitando rutas relativas largas.

---

## Cambios de imports

| Archivo | Import actual | Import nuevo |
|---|---|---|
| `app/layout.tsx` | `../components/Navbar` | `@/shared/layout/Navbar` |
| `app/layout.tsx` | `../components/Footer` | `@/shared/layout/Footer` |
| `app/layout.tsx` | `../components/ChatbotWidget` | `@/features/chatbot/components/ChatbotWidget` |
| `app/servicios/page.tsx` | `../../components/ServiceCard` | `@/shared/ui/ServiceCard` |
| `app/servicios/page.tsx` | `../../components/FeatureCard` | `@/shared/ui/FeatureCard` |
| `app/page.tsx` | `../components/ServiceCard` | `@/shared/ui/ServiceCard` |
| `app/page.tsx` | `../components/FeatureCard` | `@/shared/ui/FeatureCard` |
| `app/page.tsx` | `../components/FloatingButtons` | `@/shared/ui/FloatingButtons` |

Los tests que importan componentes de `components/` actualizan sus rutas a `shared/` o `features/chatbot/`.

---

## Migración de tests

| Test actual | Nueva ubicación |
|---|---|
| `tests/Navbar.test.tsx` | `tests/shared/Navbar.test.tsx` |
| `tests/FloatingButtons.test.tsx` | `tests/shared/FloatingButtons.test.tsx` |
| `tests/ServiceCard.test.tsx` | `tests/shared/ServiceCard.test.tsx` |
| `tests/login-page.test.tsx` | `tests/features/auth/login-page.test.tsx` |
| `tests/register-page.test.tsx` | `tests/features/auth/register-page.test.tsx` |
| `tests/dashboard-page.test.tsx` | `tests/features/dashboard/dashboard-page.test.tsx` |
| `tests/app/dashboard/` | `tests/features/dashboard/` |
| `tests/agendar-muestra-page.test.tsx` | sin mover |
| `tests/contacto-page.test.tsx` | sin mover |
| `tests/servicios-page.test.tsx` | sin mover |
| `tests/lib/api.test.ts` | sin cambios |

---

## Criterios de éxito

- `npm run build` pasa sin errores tras la migración.
- `npm run test` pasa todos los tests existentes.
- La carpeta `components/` queda eliminada.
- No hay rutas relativas `../../../` en ningún import del proyecto.
