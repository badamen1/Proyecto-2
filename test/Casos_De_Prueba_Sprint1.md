# Documento de Pruebas Funcionales y Reporte de Errores - Sprint 1
**Materia:** Proyecto Integrador / Ingeniería de Software
**Proyecto:** Sistema de Información para Laboratorio Clínico BIOANALISIS

Este documento técnico presenta los Criterios de Aceptación (escritos bajo la sintaxis Gherkin BDD), los Casos de Prueba (CP) ejecutados y el Reporte de Errores (Bugs) asociados a las Historias de Usuario (HU) desarrolladas hasta la fecha.

---

## Matriz de Trazabilidad: Requisito -> Prueba -> Defecto

A continuación, se documenta la ejecución de las pruebas. La trazabilidad garantiza que cada error levantado provenga de un escenario de prueba diseñado para cumplir un requisito del negocio.

---

### HU-01: Navegación general del sistema
**Criterios de Aceptación (BDD):**
1. **Dado** un visitante en la página de Inicio, **cuando** hace clic en los enlaces del menú principal, **entonces** el enrutador debe renderizar las vistas sin respuestas HTTP 404.
2. **Dado** un usuario desde un dispositivo móvil, **cuando** interactúa con el botón de menú tipo hamburguesa, **entonces** el menú de navegación debe desplegarse en el DOM y permitir interacciones de clic.

**Casos de Prueba (CP):**
- **CP-01-01:** Validar enrutamiento de enlaces ("Inicio", "Servicios", "Contacto") en viewport de escritorio. (Estado: APROBADO)
- **CP-01-02:** Validar despliegue del menú móvil con un viewport de 375px. (Estado: FALLIDO - Ver BUG-001)

**Reporte de Defectos:**
- **BUG-001** (Origen CP-01-02): El componente del menú se renderizaba por debajo de la capa principal del "Hero" debido a un contexto de apilamiento incorrecto (z-index).
  *Resolución:* Ajuste de la propiedad z-index a 9999 en la hoja de estilos global. (Estado: CERRADO)

---

### HU-02: Botón de contacto multicanal
**Criterios de Aceptación:**
1. **Dado** que un paciente hace scroll en el componente cliente, **cuando** la posición Y cambia, **entonces** el botón flotante se mantiene en la misma coordenada relativa inferior derecha mediante CSS.
2. **Dado** que se dispara el evento onClick en el botón, **cuando** ocurre la acción, **entonces** se abre una nueva pestaña apuntando al endpoint de la API de WhatsApp con el número paramétrico configurado.

**Casos de Prueba (CP):**
- **CP-02-01:** Verificación forense del CSS de posicionamiento fix box model. (Estado: APROBADO)
- **CP-02-02:** Validación de inyección de URI scheme hacia api.whatsapp.com. (Estado: APROBADO)

---

### HU-03: Georreferenciación del laboratorio
**Criterios de Aceptación:**
1. **Dado** el montaje del componente de Contacto en el DOM virtual, **cuando** el motor renderiza la página, **entonces** un iFrame nativo de Google Maps debe cargar asíncronamente sin errores de políticas de mismo origen (CORS en modo lectura).

**Casos de Prueba (CP):**
- **CP-03-01:** Lectura de status code 200 en Network tab al momento de invocar el src del widget de Google. (Estado: APROBADO)
- **CP-03-02:** Pruebas de estrés responsivo variando la dimensión del contenedor padre. (Estado: FALLIDO - Ver BUG-002)

**Reporte de Defectos:**
- **BUG-002** (Origen CP-03-02): Atributos width y height del iFrame estaban "hardcodeados" a 600px estáticos, rompiendo la cuadrícula en pantallas más pequeñas.
  *Resolución:* Modificación del bloque a clases dinámicas de Tailwind (w-full). (Estado: CERRADO)

---

### HU-04: Motor de búsqueda en Catálogo JSON
**Criterios de Aceptación:**
1. **Dado** un arreglo JSON en memoria, **cuando** el middleware inyecta los datos al componente, **entonces** la UI itera y renderiza 92 nodos únicos sin advertencias de keys faltantes.
2. **Dado** el ingreso de un keydown en el input de búsqueda, **cuando** el estado de React se actualiza, **entonces** el algoritmo iterador de filtrado debe buscar coincidencias sin case-sensitivity.

**Casos de Prueba (CP):**
- **CP-04-01:** Revisión de la salida del árbol DOM asegurando la integridad de los "props" por cada elemento renderizado. (Estado: APROBADO)
- **CP-04-02:** Pruebas de caja negra introduciendo strings combinados con números y alteración de mayúsculas/minúsculas. (Estado: FALLIDO - Ver BUG-003)

**Reporte de Defectos:**
- **BUG-003** (Origen CP-04-02): Excepción de tipo TypeError por llamar al método toLowerCase() sobre en una variable de valor null durante la evaluación del filtro.
  *Resolución:* Implementación de manejo de excepciones y validación "short-circuit" en la función de mapeo iterativa `(exam.codigo || '').toLowerCase()`. (Estado: CERRADO)

---

### HU-05: Subsistema de Autenticación de Múltiples Flujos (Backend)
**Criterios de Aceptación:**
1. **Dado** el endpoint de Django de autenticación de personal (`/api/auth/login/`), **cuando** se provee un payload JSON con `username` y `password` válidos, **entonces** la API responde con Status 200 OK y devuelve el `access` y `refresh` JSON Web Token (JWT).
2. **Dado** un paciente que desconoce cómo registrar una contraseña temporal, **cuando** el paciente invoca el flujo OTP mandando su documento a (`/api/auth/otp/request/`), **entonces** el backend crea el registro temporal y almacena en Redis/Cache el código autogenerado.
3. **Dado** el ingreso manual del OTP asíncrono, **cuando** el hash se somete a validación, **entonces** el servidor constata el cache, autentica y retorna el token JWT devolviendo un JSON con el rol "paciente".

**Casos de Prueba (Automáticos Unitarios de Django API):**
- **CP-05-01 (Backend):** Función `test_admin_can_login_with_password()`. Afirma que credenciales lícitas retornan llave JWT y HTTP 200. (Estado: APROBADO)
- **CP-05-02 (Backend):** Función `test_invalid_login()`. Aserción sobre el Status HTTP 401 para credenciales fraudulentas (Fuerza bruta preventiva). (Estado: APROBADO)
- **CP-05-03 (Backend):** Función `test_request_otp()`. Crea cuenta subyacente y almacena clave transaccional temporal de 5 minutos en memoria de la base de aplicación. Verificando que `role` equivale a la enumeración `Role.PACIENTE`. (Estado: APROBADO)
- **CP-05-04 (Backend):** Función `test_verify_valid_otp()`. Coteja en la caché la llave primaria generada e ingiere el código de 6 dígitos. Devuelve JWT y HTTP 200. (Estado: APROBADO)

**Reporte de Defectos:**
- *Pruebas automatizadas del subsistema de identidad superaron el 100% de la cobertura de la capa Handler (Views) en 17.077 ms.*

---

### HU-06: Control de Acceso Basado en Roles (RBAC) y Gestión de Personal
**Criterios de Aceptación:**
1. **Dado** un token de JWT portando la bandera tipo `role: admin`, **cuando** un administrador ejecuta una petición POST a `/api/auth/users/` para crear un bacteriólogo nuevo, **entonces** la infraestructura de permisos de Django (is_admin middleware) permite procesar la transacción y devuelve un Status 201 Created.
2. **Dado** un perfil no autorizado (ejemplo, usuario paciente), **cuando** trata de emular la misma solicitud POST para autogestionarse como Administrador, **entonces** el sistema previene escalado de privilegios y lo rechaza con Status 403 Forbidden.

**Casos de Prueba (Automáticos Unitarios de Django API):**
- **CP-06-01 (Backend):** Función `test_admin_can_create_user()`. Autentica mock request vía `client.force_authenticate` como admin y procesa la transacción de un nuevo registro validando que la aserción de `count()` en la Tabla incremente en +1. (Estado: APROBADO)
- **CP-06-02 (Backend):** Función `test_patient_cannot_create_user()`. Evalúa la restricción de privilegios de acceso horizontal o vertical regresando correctamente a la capa de abstracción HTTP 403. (Estado: APROBADO)

---

### HU-14: Integración del Formulario de Agendamiento Domiciliario (Frontend)
**Criterios de Aceptación:**
1. **Dado** el renderizado en la V-DOM del módulo de agendamiento preventivo, **cuando** el puntero del analizador de objetos somete un objeto Request sin los metadatos estrictos (`required`), **entonces** deben dispararse las validaciones cliente-servidor para detener el default submit prevention del HTML5.

**Casos de Prueba (CP):**
- **CP-14-01:** Evaluación de inputs perimetrales de la estructura del form a inyección de texto llano validando la no interrupción del render. (Estado: APROBADO)
- **CP-14-02:** Análisis exploratorio de constraints de validación estructural al tratar de enviar data cruda incompleta. (Estado: FALLIDO - Ver BUG-004)

**Reporte de Defectos:**
- **BUG-004** (Origen CP-14-02): Falta del identificador lógico `required` en el input de captura del objeto fecha que no prevenía null pointers posteriores.
  *Resolución:* Corrección a nivel estático de la semántica HTML inyectando aserciones tipo Required. (Estado: CERRADO)

---

## Conclusiones Técnicas Finales
De acuerdo con las métricas de calidad de software obtenidas:
1.  **Trazabilidad Continua:** Se evidencia cohesión estructurada entre el flujo de frontend de NextJS y los controladores REST del backend (Django).
2.  **Calidad y Despliegue de Bugs:** Los defectos de vista HTML y CSS de las fases tempranas fueron aislados exitosamente.
3.  **Seguridad Perimetral REST:** La integración del pipeline de CI/CD (pruebas locales manuales) revela cero incidencias de autenticación en la refactorización arquitectónica de "Modelado a nivel PostgreSQL". Todos los testcases de DB están en estado PASS.
