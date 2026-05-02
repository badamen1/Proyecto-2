"""
fasil_service.py — Capa de abstracción para integración con el sistema FASIL (LIS).

Acción 9 del Gap Analysis (A-03 / A-06):
    - A-03: El sistema viejo dependía directamente del servidor BIRT por IP interna
            (resultado.php → http://192.168.1.109:8080/BioanalisisRepo272/...)
    - A-06: El panel admin accedía directamente a tablas de FASIL (persona, tipo_doc,
            mesa, svc_ordenes) en el mismo código PHP sin abstracción.

Solución:
    Esta capa encapsula TODA la lógica de integración con FASIL.
    Las views NUNCA acceden a la BD de FASIL directamente.
    Cuando se despliega on-premise (FASIL_ENABLED=True), el servicio conecta
    a la BD MySQL de FASIL (bioanalisis272) por red local con credenciales
    configuradas en .env — tal como hacía el sistema viejo, pero sin hardcodear.

Arquitectura de conexión:
    ┌────────────────────┐       ┌─────────────────────┐
    │  Django Backend    │       │  BD FASIL (MySQL 5.5)│
    │  (PostgreSQL)      │──────>│  (via PyMySQL)      │
    │                    │ LAN   │  192.168.1.109:3306 │
    │  settings.py       │       │                     │
    │  FASIL_DB_* vars   │       │  Tablas:            │
    │                    │       │   - pct_pacientes   │
    │                    │       │   - svc_ordenes     │
    │                    │       │   - persona         │
    │                    │       │   - tipo_doc        │
    └────────────────────┘       └─────────────────────┘

    En desarrollo local (FASIL_ENABLED=False): retorna datos mock.
    En on-premise (FASIL_ENABLED=True): queries SQL reales a bioanalisis272.

Uso:
    from resultados.services.fasil_service import fasil_service

    paciente = fasil_service.get_paciente('12345678')
    ordenes  = fasil_service.get_ordenes(paciente_id='42', empresa_nit='900123456-7')
"""

import logging
import requests
from dataclasses import dataclass
from typing import Optional
from django.conf import settings

logger = logging.getLogger('resultados')


# =============================================================================
# Data Transfer Objects (DTOs) — Contratos de datos de FASIL
# =============================================================================

@dataclass
class PacienteFASIL:
    """
    Representación de un paciente proveniente del sistema FASIL.

    Equivalente en sistema viejo: fila de la tabla `pct_pacientes`
    Campos mapeados:
      - id_fasil        ← pct_pacientes.idPaciente
      - documento       ← pct_pacientes.documento
      - tipo_documento  ← pct_pacientes.idDocumento (tipo)
      - nombre_completo ← pct_pacientes.nombres + ' ' + apellidos
      - telefono        ← pct_pacientes.telefono
      - email           ← pct_pacientes.email (si existe)
    """
    id_fasil: str
    documento: str
    tipo_documento: str        # 'CC', 'TI', 'CE', 'PA', 'RC'
    nombre_completo: str
    telefono: str = ''
    email: str = ''


@dataclass
class OrdenFASIL:
    """
    Representación de una orden/resultado proveniente de FASIL.

    Equivalente en sistema viejo: fila de la tabla `svc_ordenes`
    Campos mapeados:
      - id_orden      ← svc_ordenes.idOrden
      - paciente_id   ← svc_ordenes.idPaciente
      - empresa_nit   ← svc_ordenes.idEmpresa (nullable — null = paciente particular)
      - tipo_examen   ← svc_ordenes.tipoExamen
      - fecha_examen  ← svc_ordenes.fechaOrden
      - tiene_pdf     ← indica si el resultado PDF fue generado

    Nota histórica:
      El sistema viejo generaba links al servidor BIRT:
        http://192.168.1.109:8080/BioanalisisRepo272/frameset?...
      (hallazgo A-03 del SDD — IP de servidor BIRT hardcodeada en código)
      Se elimina esa dependencia. Los PDFs se sirven desde nuestro FileField.
    """
    id_orden: str
    paciente_id: str
    tipo_examen: str
    fecha_examen: str          # ISO 8601: 'YYYY-MM-DD'
    empresa_nit: Optional[str] = None
    tiene_pdf: bool = True


@dataclass
class ContactoPacienteFASIL:
    """
    Datos de contacto de un paciente en FASIL.
    Usados para enviar el código OTP al canal correcto.

    El sistema viejo no verificaba identidad real (OTP era su propio documento).
    Este DTO habilita el envío real de OTP por WhatsApp/SMS/email.
    """
    documento: str
    telefono: str = ''
    email: str = ''


# =============================================================================
# Excepciones del servicio FASIL
# =============================================================================

class FasilError(Exception):
    """Error base para todos los fallos de integración con FASIL."""
    pass


class FasilPacienteNoEncontrado(FasilError):
    """El paciente no existe en la BD de FASIL."""
    pass


class FasilOrdenNoEncontrada(FasilError):
    """La orden/resultado no existe o no pertenece al paciente indicado."""
    pass


class FasilConexionError(FasilError):
    """No se pudo establecer conexión con FASIL (red, credenciales, timeout)."""
    pass


# =============================================================================
# Helpers internos
# =============================================================================

def _get_fasil_cursor():
    """
    Obtiene un cursor a la BD FASIL (MySQL 5.5) usando PyMySQL directo.

    IMPORTANTE: NO usa django.db.connections porque Django 5.x exige
    MySQL >= 8.0.11 y FASIL corre MySQL 5.5.56. PyMySQL conecta sin
    esa restriccion de version.

    Este cursor es READ-ONLY por diseno. Nunca se hace INSERT/UPDATE/DELETE
    en la BD de FASIL.
    """
    if not getattr(settings, 'FASIL_ENABLED', False):
        raise FasilConexionError(
            "FASIL_ENABLED=False. Conexion a BD FASIL no disponible. "
            "Activar en .env para despliegue on-premise."
        )

    try:
        import pymysql
        conn = pymysql.connect(
            host=getattr(settings, 'FASIL_DB_HOST', '192.168.1.109'),
            port=int(getattr(settings, 'FASIL_DB_PORT', 3306)),
            db=getattr(settings, 'FASIL_DB_NAME', 'bioanalisis30'),
            user=getattr(settings, 'FASIL_DB_USER', 'fasil2'),
            password=getattr(settings, 'FASIL_DB_PASSWORD', ''),
            charset='utf8mb4',
            connect_timeout=5,
        )
        return conn.cursor()
    except Exception as e:
        logger.error("FASIL conexion fallida: %s", str(e))
        raise FasilConexionError(f"No se pudo conectar a la BD FASIL: {e}")


def _is_fasil_enabled() -> bool:
    """Retorna True si la conexión a FASIL está configurada y activa."""
    return getattr(settings, 'FASIL_ENABLED', False)


# =============================================================================
# Servicio FASIL
# =============================================================================

class FasilService:
    """
    Capa de abstracción para la integración con el sistema FASIL (LIS).

    PRINCIPIO RECTOR (Contex.md):
        "El sistema NO reemplaza FASIL. Consulta, complementa y centraliza.
         Nunca acoplarse directamente a su BD."

    REGLA (CLAUDE.md / labclinic-refactor skill):
        "Views NUNCA acceden a la BD de FASIL directamente."
        "Toda lectura pasa por fasil_service."

    Modos de operación:
        FASIL_ENABLED=False (desarrollo local):
            → Retorna datos mock. No requiere acceso a MySQL.
        FASIL_ENABLED=True (on-premise en la misma red):
            → Conecta a bioanalisis272 (MySQL) por LAN.
            → Queries SQL de solo lectura a tablas FASIL.
            → Credenciales desde .env (nunca hardcodeadas).

    Las views NUNCA instancian ni llaman a FASIL directamente.
    Siempre usan esta clase a través de la instancia singleton `fasil_service`.
    """

    @property
    def enabled(self) -> bool:
        """Indica si la conexión a FASIL está activa (on-premise)."""
        return _is_fasil_enabled()

    # -------------------------------------------------------------------------
    # Pacientes
    # -------------------------------------------------------------------------

    def get_paciente(self, documento: str) -> PacienteFASIL:
        """
        Busca un paciente en FASIL por número de documento.

        Equivalente en sistema viejo (bio_cng/php/nombres.php):
            SELECT * FROM pct_pacientes
            WHERE documento = '$c'

        Args:
            documento: Número de documento del paciente (CC, TI, CE, etc.)

        Returns:
            PacienteFASIL con los datos del paciente.

        Raises:
            FasilPacienteNoEncontrado: Si el paciente no existe en FASIL.
            FasilConexionError: Si no se puede conectar con FASIL.
        """
        if not self.enabled:
            logger.info("FASIL get_paciente | documento=%s | modo=MOCK", documento)
            return self._mock_get_paciente(documento)

        logger.info("FASIL get_paciente | documento=%s | modo=REAL", documento)
        try:
            cursor = _get_fasil_cursor()
            # Query equivalente a nombres.php del sistema viejo
            # pero parametrizada (evita SQL injection — hallazgo C-01 resuelto)
            cursor.execute(
                """
                SELECT
                    p.idPaciente,
                    p.documento,
                    COALESCE(gd.codDocumento, 'CC') AS tipo_documento,
                    CONCAT(p.nomPaciente, ' ', p.apePaciente) AS nombre_completo,
                    COALESCE(p.telefono, '') AS telefono,
                    COALESCE(p.email, '') AS email
                FROM pct_pacientes p
                LEFT JOIN gnr_documentos gd ON p.idDocumento = gd.idDocumento
                WHERE p.documento = %s
                LIMIT 1
                """,
                [documento]
            )
            row = cursor.fetchone()
            cursor.close()

            if not row:
                raise FasilPacienteNoEncontrado(
                    f"Paciente con documento '{documento}' no encontrado en FASIL."
                )

            return PacienteFASIL(
                id_fasil=str(row[0]),
                documento=str(row[1]),
                tipo_documento=row[2] or 'CC',
                nombre_completo=row[3] or '',
                telefono=row[4] or '',
                email=row[5] or '',
            )

        except FasilPacienteNoEncontrado:
            raise
        except Exception as e:
            logger.error("FASIL get_paciente error: %s", str(e))
            raise FasilConexionError(f"Error consultando paciente en FASIL: {e}")

    def get_contacto_paciente(self, documento: str) -> ContactoPacienteFASIL:
        """
        Obtiene los datos de contacto de un paciente en FASIL.
        Usado para enviar el código OTP al teléfono o email registrado.

        El sistema viejo NO verificaba identidad — el "OTP" era solo el documento.
        Este método habilita el OTP real cuando se despliegue on-premise.

        Args:
            documento: Número de documento del paciente.

        Returns:
            ContactoPacienteFASIL con teléfono y/o email de contacto.
        """
        if not self.enabled:
            logger.info("FASIL get_contacto_paciente | documento=%s | modo=MOCK", documento)
            return self._mock_get_contacto(documento)

        logger.info("FASIL get_contacto_paciente | documento=%s | modo=REAL", documento)
        try:
            cursor = _get_fasil_cursor()
            cursor.execute(
                """
                SELECT documento,
                       COALESCE(telefono, '') AS telefono,
                       COALESCE(email, '') AS email
                FROM pct_pacientes
                WHERE documento = %s
                LIMIT 1
                """,
                [documento]
            )
            row = cursor.fetchone()
            cursor.close()

            if not row:
                raise FasilPacienteNoEncontrado(
                    f"Paciente con documento '{documento}' no encontrado en FASIL."
                )

            return ContactoPacienteFASIL(
                documento=str(row[0]),
                telefono=row[1] or '',
                email=row[2] or '',
            )

        except FasilPacienteNoEncontrado:
            raise
        except Exception as e:
            logger.error("FASIL get_contacto_paciente error: %s", str(e))
            raise FasilConexionError(f"Error consultando contacto en FASIL: {e}")

    # -------------------------------------------------------------------------
    # Órdenes / Resultados
    # -------------------------------------------------------------------------

    def get_ordenes(
        self,
        paciente_id: str,
        empresa_nit: Optional[str] = None,
    ) -> list[OrdenFASIL]:
        """
        Lista las órdenes/resultados de un paciente en FASIL.
        Si se pasa empresa_nit, filtra solo las órdenes de esa empresa.

        Equivalente en sistema viejo (bio_cng/php/resultado.php):
            SELECT * FROM svc_ordenes
            WHERE idPaciente = '$c'
            [AND idEmpresa = '$nit']

        El viejo sistema luego generaba un link al servidor BIRT:
            http://192.168.1.109:8080/BioanalisisRepo272/frameset?...
        (hallazgo A-03 — IP hardcodeada). Esa dependencia se elimina.

        Args:
            paciente_id: ID del paciente en FASIL (id_fasil).
            empresa_nit: NIT de la empresa para filtrar (None = todas las órdenes).

        Returns:
            Lista de OrdenFASIL. Lista vacía si no hay órdenes.
        """
        if not self.enabled:
            logger.info(
                "FASIL get_ordenes | paciente_id=%s | empresa_nit=%s | modo=MOCK",
                paciente_id, empresa_nit
            )
            return self._mock_get_ordenes(paciente_id, empresa_nit)

        logger.info(
            "FASIL get_ordenes | paciente_id=%s | empresa_nit=%s | modo=REAL",
            paciente_id, empresa_nit
        )
        try:
            cursor = _get_fasil_cursor()

            sql = """
                SELECT
                    o.idOrden,
                    o.idPaciente,
                    COALESCE(
                        (SELECT pp.namePrueba
                         FROM svc_detordenes sd
                         JOIN prb_prb pp ON sd.idPrueba = pp.idPrueba
                         WHERE sd.idOrden = o.idOrden
                         LIMIT 1),
                        'Examen de laboratorio'
                    ) AS tipo_examen,
                    DATE_FORMAT(o.fecha, '%%Y-%%m-%%d') AS fecha_examen,
                    o.idEmpresa
                FROM svc_ordenes o
                WHERE o.idPaciente = %s
            """
            params = [paciente_id]

            if empresa_nit:
                sql += " AND o.idEmpresa = %s"
                params.append(empresa_nit)

            sql += " ORDER BY o.fecha DESC"

            cursor.execute(sql, params)
            rows = cursor.fetchall()
            cursor.close()

            return [
                OrdenFASIL(
                    id_orden=str(row[0]),
                    paciente_id=str(row[1]),
                    tipo_examen=row[2] or 'No especificado',
                    fecha_examen=row[3] or '',
                    empresa_nit=str(row[4]) if row[4] else None,
                    tiene_pdf=True,
                )
                for row in rows
            ]

        except Exception as e:
            logger.error("FASIL get_ordenes error: %s", str(e))
            raise FasilConexionError(f"Error consultando órdenes en FASIL: {e}")

    def get_resultado_pdf_url(self, orden_id: str) -> str:
        """
        Construye y retorna la URL BIRT para que el navegador la abra directamente.

        BIRT usa JavaScript para generar el PDF — no se puede proxear vía requests.
        El navegador debe navegar a la URL de BIRT directamente para que el JS se ejecute.
        Esta es la misma estrategia del sistema PHP viejo (header Location), pero
        ahora el backend resuelve idEmpresa desde FASIL antes de devolver la URL.

        Args:
            orden_id: ID de la orden en FASIL (svc_ordenes.idOrden).

        Returns:
            URL completa de BIRT lista para abrir en el navegador.

        Raises:
            FasilOrdenNoEncontrada: Si idOrden no existe en svc_ordenes.
            FasilConexionError: Si no se puede conectar a FASIL.
        """
        if not self.enabled:
            logger.info("FASIL get_resultado_pdf_url | orden_id=%s | modo=MOCK", orden_id)
            raise NotImplementedError(
                "get_resultado_pdf_url() en modo MOCK. "
                "Los PDFs FASIL solo están disponibles en despliegue on-premise."
            )

        logger.info("FASIL get_resultado_pdf_url | orden_id=%s | modo=REAL", orden_id)

        # 1. Obtener idEmpresa para construir la URL BIRT
        try:
            cursor = _get_fasil_cursor()
            cursor.execute(
                "SELECT idEmpresa FROM svc_ordenes WHERE idOrden = %s LIMIT 1",
                [orden_id]
            )
            row = cursor.fetchone()
            cursor.close()
        except Exception as e:
            logger.error("FASIL get_resultado_pdf_url error buscando orden: %s", str(e))
            raise FasilConexionError(f"Error consultando orden en FASIL: {e}")

        if not row:
            raise FasilOrdenNoEncontrada(
                f"No se encontró la orden '{orden_id}' en FASIL."
            )

        empresa_id = row[0]

        # 2. Construir URL BIRT — el navegador la abre directamente
        birt_host = getattr(settings, 'FASIL_BIRT_HOST', 'http://192.168.1.109:8080')
        birt_user = getattr(settings, 'FASIL_BIRT_USER', '54')
        return (
            f"{birt_host}/BioanalisisRepo30/run"
            f"?__format=pdf"
            f"&__report=ListadoResultadosOrden4.rptdesign"
            f"&Pentrega=false"
            f"&Ptitulos=true"
            f"&Pfirmas=false"
            f"&PMDesde=0"
            f"&PMHasta=999"
            f"&Premitido=0"
            f"&PmediaCarta=false"
            f"&Ppiefirma=false"
            f"&Phistoria=Historia%20"
            f"&Pcomentario=l"
            f"&Psinfirmas=false"
            f"&Pacreditada=2"
            f"&Pconfoto=false"
            f"&Pcarpeta=a"
            f"&usuario={birt_user}"
            f"&Documento=%22%25%22"
            f"&Desde%20Empresa={empresa_id}"
            f"&Hasta%20Empresa={empresa_id}"
            f"&Desde%20Orden={orden_id}"
            f"&Hasta%20Orden={orden_id}"
        )

    # -------------------------------------------------------------------------
    # Health check
    # -------------------------------------------------------------------------

    def ping(self) -> dict:
        """
        Verifica la conectividad con FASIL.
        Útil para healthchecks y monitoring del despliegue on-premise.

        Returns:
            dict con 'status', 'modo' y 'detalle'.
        """
        if not self.enabled:
            return {
                'status': 'ok',
                'modo': 'MOCK',
                'detalle': 'FASIL_ENABLED=False. Servicio en modo mock para desarrollo.',
            }

        try:
            cursor = _get_fasil_cursor()
            cursor.execute("SELECT 1")
            cursor.close()
            return {
                'status': 'ok',
                'modo': 'REAL',
                'detalle': 'Conexión a BD FASIL (bioanalisis30) exitosa.',
            }
        except Exception as e:
            return {
                'status': 'error',
                'modo': 'REAL',
                'detalle': f'No se pudo conectar a FASIL: {e}',
            }

    # -------------------------------------------------------------------------
    # Datos mock para desarrollo local (FASIL_ENABLED=False)
    # -------------------------------------------------------------------------

    def _mock_get_paciente(self, documento: str) -> PacienteFASIL:
        """Retorna un paciente mock para desarrollo local."""
        if documento == '00000000':
            raise FasilPacienteNoEncontrado(
                f"[MOCK] Paciente con documento '{documento}' no encontrado."
            )

        return PacienteFASIL(
            id_fasil=f"FASIL-{documento}",
            documento=documento,
            tipo_documento='CC',
            nombre_completo='[Mock] Paciente FASIL de Prueba',
            telefono='3001234567',
            email='paciente.mock@ejemplo.com',
        )

    def _mock_get_contacto(self, documento: str) -> ContactoPacienteFASIL:
        """Retorna contacto mock para desarrollo local."""
        return ContactoPacienteFASIL(
            documento=documento,
            telefono='3001234567',
            email='paciente.mock@ejemplo.com',
        )

    def _mock_get_ordenes(
        self,
        paciente_id: str,
        empresa_nit: Optional[str] = None,
    ) -> list[OrdenFASIL]:
        """Retorna órdenes mock para desarrollo local."""
        return [
            OrdenFASIL(
                id_orden=f"ORD-{paciente_id}-001",
                paciente_id=paciente_id,
                tipo_examen='Hemograma Completo',
                fecha_examen='2026-04-01',
                empresa_nit=empresa_nit,
                tiene_pdf=False,
            ),
            OrdenFASIL(
                id_orden=f"ORD-{paciente_id}-002",
                paciente_id=paciente_id,
                tipo_examen='Perfil Lipídico',
                fecha_examen='2026-03-15',
                empresa_nit=empresa_nit,
                tiene_pdf=False,
            ),
        ]


# =============================================================================
# Instancia singleton — usar siempre esta, nunca instanciar FasilService()
# =============================================================================

fasil_service = FasilService()
