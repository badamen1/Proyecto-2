# Chatbot Gemini — Recomendador de Exámenes por Síntomas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Widget de chat flotante accesible a cualquier visitante que usa Gemini 2.5 Flash para recomendar exámenes de laboratorio según síntomas, con historial multi-turno en React state y proxy Django.

**Architecture:** El frontend (`ChatbotWidget.tsx`) hace POST a `/api/chatbot/` en Django. Django construye el system prompt con el catálogo de exámenes enriquecido una vez al arrancar, pasa el historial a Gemini 2.5 Flash y retorna la respuesta. El historial vive en React state (se pierde al cerrar — correcto para visitantes anónimos).

**Tech Stack:** Django 5.2, `google-generativeai` (SDK Python), `django-ratelimit` (ya instalado), Next.js 15, React 19, FontAwesome (ya cargado en layout).

---

## Mapa de archivos

| Archivo | Acción |
|---|---|
| `app/data/examenes.json` | Modificar — enriquecer con `categoria`, `descripcion`, `sintomas` |
| `backend/chatbot/__init__.py` | Crear — vacío |
| `backend/chatbot/apps.py` | Crear — configuración de la app Django |
| `backend/chatbot/urls.py` | Crear — ruta POST `/api/chatbot/` |
| `backend/chatbot/views.py` | Crear — endpoint + lógica Gemini |
| `backend/chatbot/examenes.json` | Crear — copia enriquecida para el system prompt |
| `backend/chatbot/tests.py` | Crear — tests unitarios del endpoint |
| `backend/requirements.txt` | Modificar — añadir `google-generativeai` |
| `backend/config/settings.py` | Modificar — añadir app chatbot, GEMINI_API_KEY, logger |
| `backend/.env` | Modificar — añadir `GEMINI_API_KEY=...` |
| `backend/config/urls.py` | Modificar — incluir rutas chatbot |
| `components/ChatbotWidget.tsx` | Crear — widget flotante completo |
| `app/layout.tsx` | Modificar — añadir `<ChatbotWidget />` |

---

## Task 1: Enriquecer catálogo de exámenes

**Files:**
- Modify: `app/data/examenes.json`
- Create: `backend/chatbot/examenes.json`

- [ ] **Step 1: Reemplazar `app/data/examenes.json` con el catálogo enriquecido**

Reemplazar el contenido completo del archivo con:

```json
[
  {
    "codigo": "17H",
    "nombre": "17 HIDROXIPROGESTERONA",
    "precio": 59932,
    "categoria": "Hormonas",
    "descripcion": "Mide los niveles de 17-hidroxiprogesterona producida por las glándulas suprarrenales. Se usa para detectar hiperplasia suprarrenal congénita.",
    "sintomas": ["acné", "exceso de vello corporal", "irregularidades menstruales", "infertilidad", "desarrollo precoz en niños", "genitales ambiguos en recién nacidos"]
  },
  {
    "codigo": "VAL",
    "nombre": "ACIDO VALPROICO",
    "precio": 27000,
    "categoria": "Otras",
    "descripcion": "Mide el nivel sérico del ácido valproico, medicamento antiepiléptico y estabilizador del ánimo. Monitorea la dosis terapéutica.",
    "sintomas": ["control de epilepsia", "monitoreo de medicamento antiepiléptico", "mareo por valproato", "temblor", "náuseas por medicamento"]
  },
  {
    "codigo": "LUP",
    "nombre": "ANTICOAGULANTE LUPICO",
    "precio": 45588,
    "categoria": "Coagulación",
    "descripcion": "Detecta anticuerpos que interfieren con factores de coagulación, aumentando el riesgo de trombosis. Asociado con lupus eritematoso sistémico.",
    "sintomas": ["trombosis recurrente", "abortos espontáneos repetidos", "lupus", "coágulos sin causa aparente", "trombocitopenia"]
  },
  {
    "codigo": "ACSDNA",
    "nombre": "ANTICUERPOS ANTI DNA",
    "precio": 100000,
    "categoria": "Inmunología",
    "descripcion": "Detecta anticuerpos contra el ADN de doble cadena. Marcador específico de lupus eritematoso sistémico activo.",
    "sintomas": ["lupus", "articulaciones inflamadas", "sarpullido en mariposa", "fatiga extrema", "fiebre", "daño renal", "fotosensibilidad"]
  },
  {
    "codigo": "RNP",
    "nombre": "ANTICUERPOS ANTI RNP",
    "precio": 100000,
    "categoria": "Inmunología",
    "descripcion": "Detecta anticuerpos contra ribonucleoproteínas. Positivo en enfermedades mixtas del tejido conectivo y lupus.",
    "sintomas": ["lupus", "enfermedad mixta del tejido conectivo", "fenómeno de Raynaud", "artritis", "debilidad muscular", "dificultad para tragar"]
  },
  {
    "codigo": "SSA",
    "nombre": "ANTICUERPOS ANTI SSA",
    "precio": 90000,
    "categoria": "Inmunología",
    "descripcion": "Detecta anticuerpos asociados al síndrome de Sjögren y lupus. Relevante en lupus neonatal durante el embarazo.",
    "sintomas": ["ojos secos", "boca seca", "lupus", "síndrome de Sjögren", "fatiga", "articulaciones dolorosas", "embarazo con riesgo de lupus neonatal"]
  },
  {
    "codigo": "ATG",
    "nombre": "ANTICUERPOS ANTI TIROGLOBULINICOS",
    "precio": 70000,
    "categoria": "Tiroides",
    "descripcion": "Detecta anticuerpos contra la tiroglobulina. Se usa para diagnosticar enfermedades autoinmunes de tiroides.",
    "sintomas": ["hipotiroidismo", "hipertiroidismo", "bocio", "fatiga", "aumento de peso sin causa", "intolerancia al frío", "nódulo tiroideo"]
  },
  {
    "codigo": "ANTITPO",
    "nombre": "ANTICUERPOS ANTI TIROPEROXIDASA",
    "precio": 50000,
    "categoria": "Tiroides",
    "descripcion": "Detecta anticuerpos contra la tiroperoxidasa. Principal marcador de tiroiditis de Hashimoto y enfermedad de Graves.",
    "sintomas": ["hipotiroidismo", "tiroiditis de Hashimoto", "bocio", "fatiga", "aumento de peso", "sensación de frío", "depresión", "cabello frágil"]
  },
  {
    "codigo": "FOSFG",
    "nombre": "ANTICUERPOS ANTI-FOSFOLIPIDOS IGG",
    "precio": 200000,
    "categoria": "Coagulación",
    "descripcion": "Detecta anticuerpos IgG contra fosfolípidos, asociados al síndrome antifosfolipídico. Aumenta el riesgo de trombosis y abortos.",
    "sintomas": ["trombosis venosa", "abortos recurrentes", "coágulos", "lupus", "migraña", "livedo reticularis"]
  },
  {
    "codigo": "FOSFM",
    "nombre": "ANTICUERPOS ANTI-FOSFOLIPIDOS IgM",
    "precio": 200000,
    "categoria": "Coagulación",
    "descripcion": "Detecta anticuerpos IgM contra fosfolípidos. Marcador del síndrome antifosfolipídico.",
    "sintomas": ["trombosis", "abortos espontáneos repetidos", "coágulos sin causa", "lupus", "migraña recurrente"]
  },
  {
    "codigo": "SCL",
    "nombre": "ANTICUERPOS ANTI-SCL 70",
    "precio": 75063,
    "categoria": "Inmunología",
    "descripcion": "Detecta anticuerpos anti-topoisomerasa I, específicos para esclerodermia difusa. Indica mayor riesgo de compromiso pulmonar.",
    "sintomas": ["piel endurecida", "esclerodermia", "fenómeno de Raynaud", "dificultad para tragar", "fibrosis pulmonar", "dedos hinchados"]
  },
  {
    "codigo": "SSB",
    "nombre": "ANTICUERPOS ANTI-SSB",
    "precio": 75063,
    "categoria": "Inmunología",
    "descripcion": "Detecta anticuerpos asociados principalmente al síndrome de Sjögren. Suele aparecer junto con Anti-SSA.",
    "sintomas": ["ojos secos", "boca seca", "síndrome de Sjögren", "parotiditis", "fatiga", "artritis"]
  },
  {
    "codigo": "ANAS",
    "nombre": "ANTICUERPOS ANTINUCLEARES",
    "precio": 50000,
    "categoria": "Inmunología",
    "descripcion": "Detecta anticuerpos contra estructuras del núcleo celular. Prueba de tamizaje para enfermedades autoinmunes sistémicas.",
    "sintomas": ["lupus", "artritis reumatoide", "fatiga crónica", "sarpullido", "fiebre sin causa", "dolor articular", "esclerodermia"]
  },
  {
    "codigo": "ENAS",
    "nombre": "ANTICUERPOS ANTINUCLEARES EXTRACTABLES TOTALES ENA",
    "precio": 140000,
    "categoria": "Inmunología",
    "descripcion": "Panel de anticuerpos contra antígenos nucleares extraíbles (SSA, SSB, RNP, Sm). Específico para varias enfermedades autoinmunes.",
    "sintomas": ["lupus", "síndrome de Sjögren", "esclerodermia", "polimiositis", "enfermedad mixta del tejido conectivo", "artritis inflamatoria"]
  },
  {
    "codigo": "ACSHEPC",
    "nombre": "ANTICUERPOS DE HEPATITIS C",
    "precio": 60000,
    "categoria": "Infectología",
    "descripcion": "Detecta anticuerpos contra el virus de la hepatitis C. Indica exposición pasada o infección activa por VHC.",
    "sintomas": ["ictericia", "cansancio extremo", "dolor abdominal derecho", "orina oscura", "heces claras", "náuseas", "exposición a sangre", "cirrosis"]
  },
  {
    "codigo": "RUBG",
    "nombre": "ANTICUERPOS IgG RUBEOLA",
    "precio": 54234,
    "categoria": "Infectología",
    "descripcion": "Detecta inmunidad previa contra la rubéola. Importante en mujeres en edad fértil para verificar protección antes del embarazo.",
    "sintomas": ["evaluación preconcepcional", "embarazo", "verificar inmunidad a rubeola", "sarpullido", "ganglios inflamados"]
  },
  {
    "codigo": "RUBM",
    "nombre": "ANTICUERPOS IgM RUBEOLA",
    "precio": 54234,
    "categoria": "Infectología",
    "descripcion": "Detecta infección aguda o reciente por rubéola. Crítico en el primer trimestre de embarazo por el riesgo al feto.",
    "sintomas": ["sarpullido rosado", "fiebre leve", "ganglios inflamados detrás de las orejas", "embarazo", "articulaciones dolorosas", "conjuntivitis"]
  },
  {
    "codigo": "ACSTRIP",
    "nombre": "ANTICUERPOS TRYPANOSOMA CRUZI",
    "precio": 1,
    "categoria": "Infectología",
    "descripcion": "Detecta anticuerpos contra Trypanosoma cruzi, parásito causante de la enfermedad de Chagas. Endémica en zonas rurales de Latinoamérica.",
    "sintomas": ["enfermedad de Chagas", "hinchazón en lugar de picadura", "fiebre", "arritmias cardíacas", "megacolon", "zona endémica de Chagas"]
  },
  {
    "codigo": "CA153",
    "nombre": "ANTIGENO CA 15-3 (CANCER DE MAMA)",
    "precio": 140000,
    "categoria": "Oncología",
    "descripcion": "Marcador tumoral para monitorear el tratamiento y recurrencia del cáncer de mama. No se usa para diagnóstico inicial.",
    "sintomas": ["seguimiento cáncer de mama", "control postoperatorio mamario", "recurrencia tumoral", "masa en mama", "tratamiento oncológico"]
  },
  {
    "codigo": "AgCCA",
    "nombre": "ANTÍGENO CCA",
    "precio": 1,
    "categoria": "Oncología",
    "descripcion": "Marcador tumoral para carcinoma de células escamosas de cuello uterino y otros epitelios.",
    "sintomas": ["cáncer de cuello uterino", "seguimiento oncológico", "control post-tratamiento cervical"]
  },
  {
    "codigo": "BICAR",
    "nombre": "BICARBONATO",
    "precio": 40000,
    "categoria": "Metabolismo",
    "descripcion": "Mide el bicarbonato sérico, indicador del equilibrio ácido-base. Útil en enfermedades renales y pulmonares.",
    "sintomas": ["dificultad respiratoria", "insuficiencia renal", "vómitos persistentes", "diarrea crónica", "confusión mental", "acidosis"]
  },
  {
    "codigo": "BIOP",
    "nombre": "BIOPSIA",
    "precio": 120000,
    "categoria": "Otras",
    "descripcion": "Análisis histológico de tejido extraído para diagnóstico de enfermedades, especialmente cáncer.",
    "sintomas": ["masa o tumor", "lesión sospechosa", "diagnóstico oncológico", "úlcera que no cicatriza", "ganglio inflamado sin causa"]
  },
  {
    "codigo": "CA125",
    "nombre": "CA 125 (ANTÍGENO C.A. DE OVARIO) - CA 125",
    "precio": 101001,
    "categoria": "Oncología",
    "descripcion": "Marcador tumoral para monitorear el cáncer de ovario. También puede elevarse en endometriosis y enfermedades benignas.",
    "sintomas": ["dolor pélvico", "abdomen distendido", "seguimiento cáncer de ovario", "endometriosis", "masa ovárica", "control oncológico"]
  },
  {
    "codigo": "CA199",
    "nombre": "CA 19-9 (ANTÍGENO DE CANCER) - CA19-9",
    "precio": 101001,
    "categoria": "Oncología",
    "descripcion": "Marcador tumoral para cáncer de páncreas y vías biliares. También puede elevarse en cáncer colorrectal.",
    "sintomas": ["dolor abdominal", "ictericia", "pérdida de peso", "seguimiento cáncer de páncreas", "cáncer colorrectal", "control oncológico digestivo"]
  },
  {
    "codigo": "CARBA",
    "nombre": "CARBAMAZEPINA NIVELES SERICOS",
    "precio": 40000,
    "categoria": "Otras",
    "descripcion": "Mide el nivel sérico de carbamazepina, medicamento antiepiléptico. Para ajustar dosis y verificar toxicidad.",
    "sintomas": ["monitoreo de epilepsia", "control de medicamento anticonvulsivante", "mareo", "visión doble", "ataxia por carbamazepina"]
  },
  {
    "codigo": "CARDIOG",
    "nombre": "CARDIOLIPINA IgG",
    "precio": 50000,
    "categoria": "Coagulación",
    "descripcion": "Detecta anticuerpos IgG contra cardiolipina, asociados al síndrome antifosfolipídico. Aumenta el riesgo de trombosis.",
    "sintomas": ["trombosis recurrente", "abortos espontáneos repetidos", "lupus", "coágulos sin causa", "migraña"]
  },
  {
    "codigo": "CARDIOM",
    "nombre": "CARDIOLIPINA IgM",
    "precio": 44000,
    "categoria": "Coagulación",
    "descripcion": "Detecta anticuerpos IgM contra cardiolipina. Marcador del síndrome antifosfolipídico.",
    "sintomas": ["trombosis", "abortos repetidos", "lupus", "coágulos", "livedo reticularis"]
  },
  {
    "codigo": "CARGA",
    "nombre": "CARGA VIRAL HIV",
    "precio": 290000,
    "categoria": "Infectología",
    "descripcion": "Mide la cantidad de virus HIV en la sangre. Fundamental para monitorear la eficacia del tratamiento antirretroviral.",
    "sintomas": ["HIV positivo", "seguimiento tratamiento antirretroviral", "inmunodeficiencia", "infecciones oportunistas"]
  },
  {
    "codigo": "CITOG",
    "nombre": "CITOMEGALOVIRUS ANTICUERPOS G",
    "precio": 54000,
    "categoria": "Infectología",
    "descripcion": "Detecta anticuerpos IgG contra citomegalovirus (CMV). Indica infección pasada o inmunidad adquirida.",
    "sintomas": ["mononucleosis infecciosa", "fiebre prolongada", "control en embarazo", "trasplante", "inmunosupresión", "fatiga severa"]
  },
  {
    "codigo": "CITOM",
    "nombre": "CITOMEGALOVIRUS ANTICUERPOS M",
    "precio": 54000,
    "categoria": "Infectología",
    "descripcion": "Detecta anticuerpos IgM contra citomegalovirus. Indica infección activa o reciente por CMV.",
    "sintomas": ["fiebre alta", "ganglios inflamados", "cansancio extremo", "dolor de garganta", "embarazo", "inmunosupresión"]
  },
  {
    "codigo": "C3",
    "nombre": "COMPLEMENTO C3",
    "precio": 45000,
    "categoria": "Inmunología",
    "descripcion": "Mide la proteína C3 del sistema complemento. Disminuye en lupus activo y algunas glomerulonefritis.",
    "sintomas": ["lupus", "enfermedad renal", "infecciones recurrentes", "glomerulonefritis", "artritis inflamatoria"]
  },
  {
    "codigo": "C4",
    "nombre": "COMPLEMENTO C4",
    "precio": 30000,
    "categoria": "Inmunología",
    "descripcion": "Mide la proteína C4 del sistema complemento. Útil junto al C3 para evaluar enfermedades autoinmunes.",
    "sintomas": ["lupus", "angioedema hereditario", "glomerulonefritis", "infecciones bacterianas recurrentes", "enfermedad autoinmune"]
  },
  {
    "codigo": "PLASMA",
    "nombre": "CONSERVACION DE PLASMA",
    "precio": 1,
    "categoria": "Otras",
    "descripcion": "Servicio de conservación de muestra de plasma para análisis posterior o envío a laboratorio de referencia.",
    "sintomas": []
  },
  {
    "codigo": "SUERO",
    "nombre": "CONSERVACION DE SUERO",
    "precio": 1,
    "categoria": "Otras",
    "descripcion": "Servicio de conservación de muestra de suero para análisis posterior o envío a laboratorio de referencia.",
    "sintomas": []
  },
  {
    "codigo": "COOIC",
    "nombre": "COOMBS INDIRECTO CUALITATIVA",
    "precio": 70000,
    "categoria": "Hematología",
    "descripcion": "Detecta anticuerpos en el suero que pueden reaccionar contra glóbulos rojos. Importante en transfusiones y embarazo con Rh negativo.",
    "sintomas": ["incompatibilidad de grupo sanguíneo", "preparación para transfusión", "embarazo con factor Rh negativo", "anemia hemolítica"]
  },
  {
    "codigo": "CORTI",
    "nombre": "CORTISOL",
    "precio": 40000,
    "categoria": "Hormonas",
    "descripcion": "Mide el cortisol, hormona del estrés producida por las glándulas suprarrenales. Diagnóstica para síndrome de Cushing e insuficiencia suprarrenal (Addison).",
    "sintomas": ["obesidad central", "estrías", "cara de luna llena", "hipertensión", "debilidad muscular", "fatiga extrema", "hipotensión", "pigmentación de piel"]
  },
  {
    "codigo": "CORT",
    "nombre": "CORTISOL",
    "precio": 50000,
    "categoria": "Hormonas",
    "descripcion": "Mide el cortisol, hormona del estrés producida por las glándulas suprarrenales. Diagnóstica para síndrome de Cushing e insuficiencia suprarrenal (Addison).",
    "sintomas": ["obesidad central", "estrías", "cara de luna llena", "hipertensión", "debilidad muscular", "fatiga extrema", "hipotensión", "pigmentación de piel"]
  },
  {
    "codigo": "HONGO",
    "nombre": "CULTIVO DE HONGOS MICOSIS SUPERFICIAL",
    "precio": 93000,
    "categoria": "Microbiología",
    "descripcion": "Identifica hongos causantes de infecciones superficiales como pie de atleta, tiña y candidiasis cutánea.",
    "sintomas": ["picazón en la piel", "descamación", "manchas en la piel", "pie de atleta", "uñas engrosadas o amarillas", "sarpullido circular", "candidiasis cutánea"]
  },
  {
    "codigo": "CURETRAL",
    "nombre": "CULTIVO SECRECION URETRAL",
    "precio": 88000,
    "categoria": "Microbiología",
    "descripcion": "Identifica bacterias causantes de infecciones de transmisión sexual en la uretra, como gonorrea y clamidia.",
    "sintomas": ["secreción uretral", "ardor al orinar", "infección de transmisión sexual", "gonorrea", "clamidia", "dolor al orinar"]
  },
  {
    "codigo": "DEHIDRO",
    "nombre": "DEHIDROEPIANDROSTERONA",
    "precio": 50000,
    "categoria": "Hormonas",
    "descripcion": "Mide el DHEA-S, hormona suprarrenal precursora de andrógenos y estrógenos. Útil en el estudio del exceso androgénico.",
    "sintomas": ["exceso de vello", "acné", "irregularidades menstruales", "infertilidad", "síndrome de ovario poliquístico", "virilización"]
  },
  {
    "codigo": "DIHTESTO",
    "nombre": "DIHIDROTESTOSTERONA",
    "precio": 130000,
    "categoria": "Hormonas",
    "descripcion": "Mide el DHT, la forma activa de testosterona. Relacionado con calvicie masculina, hiperplasia prostática e hirsutismo.",
    "sintomas": ["calvicie", "hiperplasia prostática", "vello facial excesivo en mujeres", "acné severo", "infertilidad masculina"]
  },
  {
    "codigo": "NUCAL",
    "nombre": "ECOGRAFIA OBTRETICA CON TRANSLUCENCIA NUCAL",
    "precio": 115000,
    "categoria": "Otras",
    "descripcion": "Ecografía del primer trimestre que mide la translucencia nucal del feto para evaluar el riesgo de síndrome de Down y otras cromosomopatías.",
    "sintomas": ["embarazo primer trimestre", "tamizaje Down", "control prenatal", "riesgo genético fetal"]
  },
  {
    "codigo": "ECOGRA",
    "nombre": "ECOGRAFIA PELVICA TRASVAGINAL",
    "precio": 120000,
    "categoria": "Otras",
    "descripcion": "Ecografía que evalúa los órganos pélvicos femeninos (útero, ovarios) con mayor detalle que la ecografía abdominal.",
    "sintomas": ["dolor pélvico", "irregularidades menstruales", "quiste ovárico", "mioma uterino", "infertilidad", "sangrado anormal", "endometriosis"]
  },
  {
    "codigo": "ELECTHB",
    "nombre": "ELECTROFORESIS DE HEMOGLOBINA",
    "precio": 60000,
    "categoria": "Hematología",
    "descripcion": "Identifica los tipos de hemoglobina en la sangre. Diagnóstica para anemia de células falciformes, talasemia y otras hemoglobinopatías.",
    "sintomas": ["anemia severa", "ictericia", "fatiga extrema", "dolor de huesos", "antecedentes familiares de anemia", "esplenomegalia"]
  },
  {
    "codigo": "ESTR",
    "nombre": "ESTRADIOL",
    "precio": 60000,
    "categoria": "Hormonas",
    "descripcion": "Mide el estradiol (E2), principal hormona estrogénica. Útil para evaluar la función ovárica, menopausia, infertilidad y ciclo menstrual.",
    "sintomas": ["irregularidades menstruales", "infertilidad", "menopausia", "sofocos", "osteoporosis", "síndrome de ovario poliquístico", "evaluación hormonal"]
  },
  {
    "codigo": "OCUP",
    "nombre": "EXAMEN OCUPACIONAL",
    "precio": 60000,
    "categoria": "Otras",
    "descripcion": "Conjunto de exámenes para evaluar la aptitud laboral. Requerido por empresas para ingreso o control periódico de trabajadores.",
    "sintomas": ["ingreso laboral", "control médico ocupacional", "certificado médico de trabajo"]
  },
  {
    "codigo": "FERR",
    "nombre": "FERRITINA",
    "precio": 60000,
    "categoria": "Hematología",
    "descripcion": "Mide las reservas de hierro en el cuerpo. El indicador más sensible para detectar deficiencia de hierro antes de que aparezca la anemia.",
    "sintomas": ["fatiga", "debilidad", "palidez", "caída de cabello", "uñas quebradizas", "mareo", "anemia", "intolerancia al ejercicio"]
  },
  {
    "codigo": "GLFOD",
    "nombre": "GLUCOSA 6 FOSFATO DISHIDROGENASA",
    "precio": 103000,
    "categoria": "Metabolismo",
    "descripcion": "Mide la actividad de la enzima G6PD en glóbulos rojos. Su deficiencia es la enzimoptía más común y causa anemia hemolítica.",
    "sintomas": ["anemia hemolítica", "ictericia en recién nacido", "orina oscura después de medicamentos", "reacción a habas", "fatiga"]
  },
  {
    "codigo": "HEMOSIS",
    "nombre": "HEMOSISTEINA",
    "precio": 148000,
    "categoria": "Metabolismo",
    "descripcion": "Mide la homocisteína en sangre. Niveles elevados son factor de riesgo cardiovascular y se asocian con deficiencia de vitaminas B.",
    "sintomas": ["riesgo cardiovascular", "trombosis", "arteriosclerosis", "deficiencia de vitamina B12", "deficiencia de folato", "infarto previo"]
  },
  {
    "codigo": "HEPAG",
    "nombre": "HEPATITIS A, ANTICUERPOS IgG",
    "precio": 90000,
    "categoria": "Infectología",
    "descripcion": "Detecta inmunidad contra el virus de la hepatitis A (infección pasada o vacunación).",
    "sintomas": ["verificar inmunidad hepatitis A", "control post-vacunación", "viaje a zonas endémicas", "ictericia previa"]
  },
  {
    "codigo": "HEPAM",
    "nombre": "HEPATITIS A, ANTICUERPOS IgM",
    "precio": 90000,
    "categoria": "Infectología",
    "descripcion": "Detecta infección aguda o reciente por el virus de la hepatitis A.",
    "sintomas": ["ictericia", "orina oscura", "náuseas", "vómitos", "dolor abdominal derecho", "fiebre", "heces claras"]
  },
  {
    "codigo": "HEPBCENT",
    "nombre": "HEPATITIS B ANTICUERPOS CENTRAL IgM",
    "precio": 50000,
    "categoria": "Infectología",
    "descripcion": "Detecta infección aguda por el virus de la hepatitis B. El anti-HBc IgM es el marcador de infección reciente.",
    "sintomas": ["ictericia aguda", "fatiga severa", "dolor abdominal", "exposición reciente al virus B", "hepatitis aguda"]
  },
  {
    "codigo": "HEPBTOT",
    "nombre": "HEPATITIS B, ANTICUERPO CENTRAL TOTALES",
    "precio": 48000,
    "categoria": "Infectología",
    "descripcion": "Detecta infección pasada o presente por hepatitis B. Persiste de por vida tras la infección.",
    "sintomas": ["evaluación hepatitis B", "ictericia", "cirrosis", "donación de sangre", "control hepático"]
  },
  {
    "codigo": "HBE",
    "nombre": "HEPATITIS B, ANTICUERPOS E",
    "precio": 1,
    "categoria": "Infectología",
    "descripcion": "Detecta el antígeno o anticuerpo 'e' del virus de la hepatitis B. Indica nivel de replicación viral.",
    "sintomas": ["hepatitis B crónica", "seguimiento tratamiento hepatitis B", "alta replicación viral"]
  },
  {
    "codigo": "HERPES I",
    "nombre": "HERPES I ANTICUERPOS IGG",
    "precio": 100000,
    "categoria": "Infectología",
    "descripcion": "Detecta anticuerpos IgG contra herpes simple tipo 1 (HSV-1). Indica infección pasada, generalmente herpes oral.",
    "sintomas": ["fuego labial recurrente", "herpes oral", "úlceras en boca", "evaluación herpes labial"]
  },
  {
    "codigo": "HERPEIGM",
    "nombre": "HERPES I ANTICUERPOS IGM",
    "precio": 100000,
    "categoria": "Infectología",
    "descripcion": "Detecta anticuerpos IgM contra HSV-1. Indica infección activa o reciente por herpes tipo 1.",
    "sintomas": ["fuego labial activo", "úlceras orales", "fiebre", "herpes oral agudo"]
  },
  {
    "codigo": "HERPESG",
    "nombre": "HERPES II ANTICUERPOS IgG",
    "precio": 100000,
    "categoria": "Infectología",
    "descripcion": "Detecta anticuerpos IgG contra herpes simple tipo 2 (HSV-2). Indica infección pasada por herpes genital.",
    "sintomas": ["herpes genital", "úlceras genitales recurrentes", "evaluación ITS", "embarazo con riesgo de herpes neonatal"]
  },
  {
    "codigo": "HERPESM",
    "nombre": "HERPES II ANTICUERPOS IgM",
    "precio": 100000,
    "categoria": "Infectología",
    "descripcion": "Detecta anticuerpos IgM contra HSV-2. Indica infección activa o reciente por herpes genital.",
    "sintomas": ["úlceras genitales activas", "ardor genital", "herpes genital agudo", "ITS"]
  },
  {
    "codigo": "SH",
    "nombre": "HORMONA DE CRECIMIENTO",
    "precio": 180000,
    "categoria": "Hormonas",
    "descripcion": "Mide la hormona de crecimiento (GH). Útil para diagnosticar deficiencia en niños y acromegalia en adultos.",
    "sintomas": ["baja estatura en niños", "crecimiento lento", "acromegalia", "manos y pies grandes", "cara tosca", "déficit de hormona de crecimiento"]
  },
  {
    "codigo": "TSH NEO",
    "nombre": "HORMONA ESTIMULANTE DE TIROIDES TSH NEONATAL",
    "precio": 19800,
    "categoria": "Tiroides",
    "descripcion": "Tamizaje neonatal para hipotiroidismo congénito. Se realiza en los primeros días de vida.",
    "sintomas": ["tamizaje neonatal", "recién nacido", "hipotiroidismo congénito", "ictericia prolongada en bebé", "alimentación lenta en recién nacido"]
  },
  {
    "codigo": "IgA",
    "nombre": "INMUNOGLOBULINA IgA",
    "precio": 62000,
    "categoria": "Inmunología",
    "descripcion": "Mide los niveles de inmunoglobulina A. Disminuida en inmunodeficiencia selectiva IgA; elevada en algunas infecciones crónicas.",
    "sintomas": ["infecciones respiratorias recurrentes", "diarrea crónica", "enfermedad celíaca", "inmunodeficiencia", "alergia severa"]
  },
  {
    "codigo": "INS",
    "nombre": "INSULINA",
    "precio": 55000,
    "categoria": "Hormonas",
    "descripcion": "Mide los niveles de insulina en sangre. Útil para evaluar resistencia a la insulina, diabetes tipo 2 y síndrome metabólico.",
    "sintomas": ["diabetes", "obesidad", "acantosis nigricans", "síndrome metabólico", "glucosa alta en ayunas", "síndrome de ovario poliquístico", "hipoglucemia"]
  },
  {
    "codigo": "CD3",
    "nombre": "LINFOCITOS CD3",
    "precio": 40000,
    "categoria": "Inmunología",
    "descripcion": "Mide la población total de linfocitos T en sangre. Útil para evaluar el sistema inmunológico celular.",
    "sintomas": ["inmunodeficiencia", "HIV", "infecciones recurrentes", "seguimiento trasplante", "linfoma", "evaluación inmunológica"]
  },
  {
    "codigo": "CD4",
    "nombre": "LINFOCITOS CD4",
    "precio": 40000,
    "categoria": "Inmunología",
    "descripcion": "Mide los linfocitos T helper CD4+. Principal marcador para monitorear la progresión del HIV/SIDA e iniciar tratamiento.",
    "sintomas": ["HIV positivo", "inmunodeficiencia", "infecciones oportunistas", "SIDA", "seguimiento tratamiento antirretroviral"]
  },
  {
    "codigo": "CD8",
    "nombre": "LINFOCITOS CD8",
    "precio": 1,
    "categoria": "Inmunología",
    "descripcion": "Mide los linfocitos T citotóxicos CD8+. Se evalúa junto al CD4 en HIV y seguimiento de trasplantes.",
    "sintomas": ["HIV", "inmunodeficiencia", "seguimiento trasplante", "infecciones virales recurrentes"]
  },
  {
    "codigo": "LITIO",
    "nombre": "LITIO",
    "precio": 40000,
    "categoria": "Otras",
    "descripcion": "Mide el nivel sérico de litio, estabilizador del ánimo usado en trastorno bipolar. Para ajustar dosis y detectar toxicidad.",
    "sintomas": ["monitoreo trastorno bipolar", "control medicamento litio", "temblor", "poliuria", "polidipsia"]
  },
  {
    "codigo": "EVERO",
    "nombre": "NIVELES DE EVEROLIMUS",
    "precio": 185000,
    "categoria": "Otras",
    "descripcion": "Mide el nivel sérico de everolimus, inmunosupresor usado en trasplante y tratamiento de algunos tumores.",
    "sintomas": ["trasplante de órgano", "monitoreo inmunosupresor", "cáncer con tratamiento de everolimus"]
  },
  {
    "codigo": "OPTOME",
    "nombre": "OPTOMETRIA",
    "precio": 60000,
    "categoria": "Otras",
    "descripcion": "Evaluación de la agudeza visual y salud ocular. Diagnóstica para miopía, hipermetropía, astigmatismo y glaucoma.",
    "sintomas": ["visión borrosa", "dificultad para leer", "dolor de cabeza frecuente", "fatiga visual", "miopía", "necesidad de gafas"]
  },
  {
    "codigo": "OSTEOM",
    "nombre": "OSTEOMUSCULAR",
    "precio": 50000,
    "categoria": "Otras",
    "descripcion": "Evaluación del sistema osteomuscular para exámenes ocupacionales. Incluye evaluación de columna, articulaciones y masa muscular.",
    "sintomas": ["dolor de espalda", "dolor articular", "certificado médico laboral", "examen ocupacional musculoesquelético"]
  },
  {
    "codigo": "VPH",
    "nombre": "PAPILOMAVIRUS POR PCR CON TIPIFICACION DE 14 CEPAS (Alto Riesgo)",
    "precio": 190000,
    "categoria": "Oncología",
    "descripcion": "Detecta y tipifica 14 cepas de alto riesgo del VPH mediante PCR. Fundamental para la prevención del cáncer de cuello uterino.",
    "sintomas": ["control ginecológico", "resultado anormal en citología", "prevención cáncer cervical", "verrugas genitales", "ITS"]
  },
  {
    "codigo": "PTH",
    "nombre": "PARATOHORMONA PTH",
    "precio": 76438,
    "categoria": "Metabolismo",
    "descripcion": "Mide la hormona paratiroidea. Regula calcio y fósforo. Útil para diagnosticar hiperparatiroidismo e hipoparatiroidismo.",
    "sintomas": ["cálculos renales", "osteoporosis", "calcio alto en sangre", "debilidad muscular", "calambres", "hormigueo", "enfermedad renal crónica"]
  },
  {
    "codigo": "PLOMO",
    "nombre": "PLOMO",
    "precio": 98900,
    "categoria": "Otras",
    "descripcion": "Mide los niveles de plomo en sangre. Para detectar intoxicación por plomo en trabajadores expuestos y niños.",
    "sintomas": ["exposición laboral a plomo", "dolor abdominal", "confusión mental", "cefalea", "anemia", "retraso en desarrollo en niños"]
  },
  {
    "codigo": "PROGE",
    "nombre": "PROGESTERONA",
    "precio": 70000,
    "categoria": "Hormonas",
    "descripcion": "Mide los niveles de progesterona. Útil para evaluar la ovulación, diagnosticar insuficiencia lútea y monitorear el embarazo temprano.",
    "sintomas": ["infertilidad", "abortos espontáneos recurrentes", "irregularidades menstruales", "síndrome premenstrual severo", "embarazo temprano"]
  },
  {
    "codigo": "PROGES",
    "nombre": "PROGESTERONA",
    "precio": 70000,
    "categoria": "Hormonas",
    "descripcion": "Mide los niveles de progesterona. Útil para evaluar la ovulación, diagnosticar insuficiencia lútea y monitorear el embarazo temprano.",
    "sintomas": ["infertilidad", "abortos espontáneos recurrentes", "irregularidades menstruales", "síndrome premenstrual severo", "embarazo temprano"]
  },
  {
    "codigo": "PROTEC",
    "nombre": "PROTEINA C DE LA COAGULACION",
    "precio": 120000,
    "categoria": "Coagulación",
    "descripcion": "Mide la proteína C, anticoagulante natural. Su deficiencia aumenta el riesgo de trombosis venosa profunda.",
    "sintomas": ["trombosis venosa profunda", "tromboembolismo pulmonar", "coágulos recurrentes", "historia familiar de trombosis"]
  },
  {
    "codigo": "PROTES",
    "nombre": "PROTEINA S DE LA COAGULACION",
    "precio": 246000,
    "categoria": "Coagulación",
    "descripcion": "Mide la proteína S, cofactor de la proteína C. Su deficiencia predispone a trombosis. Se evalúa en estudio de trombofilia.",
    "sintomas": ["trombosis recurrente", "embolia pulmonar", "coágulos en venas profundas", "historia familiar de trombosis", "abortos recurrentes"]
  },
  {
    "codigo": "PTHS",
    "nombre": "PROTEINA TRANSPORTADORA DE HORMONA SEXUAL",
    "precio": 1,
    "categoria": "Hormonas",
    "descripcion": "Mide la SHBG, proteína que transporta testosterona y estradiol. Útil en el estudio de hiperandrogenismo.",
    "sintomas": ["exceso de vello en mujeres", "acné", "síndrome de ovario poliquístico", "irregularidades menstruales", "infertilidad", "diabetes tipo 2"]
  },
  {
    "codigo": "COVID19",
    "nombre": "PRUEBA DE EXUDADO COVID19",
    "precio": 300000,
    "categoria": "Infectología",
    "descripcion": "Detecta la presencia del virus SARS-CoV-2 mediante hisopado nasofaríngeo para diagnóstico de COVID-19 activo.",
    "sintomas": ["fiebre", "tos seca", "dificultad para respirar", "pérdida del olfato", "pérdida del gusto", "dolor de cuerpo", "contacto con caso COVID"]
  },
  {
    "codigo": "PATERN",
    "nombre": "PRUEBA DE PATERNIDAD",
    "precio": 780000,
    "categoria": "Otras",
    "descripcion": "Análisis de ADN para determinar la relación biológica padre-hijo con precisión mayor al 99.9%.",
    "sintomas": ["determinación de paternidad", "análisis de ADN familiar"]
  },
  {
    "codigo": "ADDIS",
    "nombre": "Recuento de Addis, Orina de 12 horas",
    "precio": 25000,
    "categoria": "Hematología",
    "descripcion": "Cuantifica eritrocitos, leucocitos y cilindros en orina de 12 horas. Evalúa la función glomerular renal.",
    "sintomas": ["orina con sangre", "proteinuria", "enfermedad renal", "glomerulonefritis", "nefritis", "control renal"]
  },
  {
    "codigo": "TESTL",
    "nombre": "TESTOSTERONA LIBRE",
    "precio": 58000,
    "categoria": "Hormonas",
    "descripcion": "Mide la fracción activa de testosterona no unida a proteínas. Más sensible que la testosterona total para detectar déficits.",
    "sintomas": ["fatiga crónica", "disminución de la libido", "disfunción eréctil", "pérdida de masa muscular", "depresión en hombres", "infertilidad masculina"]
  },
  {
    "codigo": "TEST",
    "nombre": "TESTOSTERONA TOTAL",
    "precio": 48000,
    "categoria": "Hormonas",
    "descripcion": "Mide la testosterona total en sangre (libre + unida a proteínas). Útil para evaluar hipogonadismo masculino e hiperandrogenismo femenino.",
    "sintomas": ["disminución de libido", "disfunción eréctil", "infertilidad", "acné severo", "exceso de vello en mujeres", "pérdida de masa muscular"]
  },
  {
    "codigo": "TIROG",
    "nombre": "TIROGLOBULINA",
    "precio": 80000,
    "categoria": "Tiroides",
    "descripcion": "Mide la tiroglobulina sérica. Principal marcador para el seguimiento del cáncer diferenciado de tiroides post-tratamiento.",
    "sintomas": ["seguimiento cáncer de tiroides", "nódulo tiroideo", "control post-tiroidectomía", "recurrencia cáncer tiroideo"]
  },
  {
    "codigo": "TRANS",
    "nombre": "TRANSFERRINA",
    "precio": 70000,
    "categoria": "Metabolismo",
    "descripcion": "Mide la proteína que transporta el hierro en la sangre. Útil para el diagnóstico de anemia ferropénica y sobrecarga de hierro.",
    "sintomas": ["anemia", "fatiga", "palidez", "sobrecarga de hierro", "hemocromatosis", "desnutrición", "enfermedad hepática"]
  },
  {
    "codigo": "TREPO",
    "nombre": "TREPONEMA PALLIDUM ANTICUERPOS IgM",
    "precio": 160000,
    "categoria": "Infectología",
    "descripcion": "Detecta anticuerpos IgM contra Treponema pallidum, bacteria causante de la sífilis. Indica infección activa o reciente.",
    "sintomas": ["úlcera genital", "sarpullido en palmas y plantas", "sífilis", "ITS", "ganglios inflamados", "fiebre", "embarazo con control prenatal"]
  },
  {
    "codigo": "VITK",
    "nombre": "VITAMINA K",
    "precio": 285000,
    "categoria": "Metabolismo",
    "descripcion": "Mide los niveles de vitamina K, esencial para la coagulación sanguínea y la salud ósea.",
    "sintomas": ["sangrado excesivo", "hematomas fáciles", "sangrado de encías", "anticoagulación con warfarina", "recién nacido con sangrado", "malnutrición"]
  },
  {
    "codigo": "VITD",
    "nombre": "VITAMNA D 25 HIDROXI",
    "precio": 110000,
    "categoria": "Metabolismo",
    "descripcion": "Mide el nivel de vitamina D. Su deficiencia se asocia con osteoporosis, fatiga y alteraciones del sistema inmune.",
    "sintomas": ["osteoporosis", "dolores óseos", "fatiga crónica", "debilidad muscular", "depresión", "infecciones frecuentes", "poca exposición solar", "fracturas frecuentes"]
  },
  {
    "codigo": "WARFARIN",
    "nombre": "WARFARINA",
    "precio": 95000,
    "categoria": "Otras",
    "descripcion": "Mide el efecto anticoagulante de la warfarina a través del INR. Fundamental para ajustar la dosis en pacientes con tratamiento anticoagulante.",
    "sintomas": ["monitoreo anticoagulante", "sangrado excesivo", "tratamiento con warfarina", "fibrilación auricular", "trombosis bajo tratamiento"]
  },
  {
    "codigo": "WESTERN",
    "nombre": "WESTERN BLOT",
    "precio": 230000,
    "categoria": "Infectología",
    "descripcion": "Prueba confirmatoria para el diagnóstico de HIV, utilizada después de un ELISA positivo.",
    "sintomas": ["confirmación HIV", "ELISA positivo para HIV", "inmunodeficiencia", "riesgo de HIV"]
  },
  {
    "codigo": "ZINC",
    "nombre": "ZINC",
    "precio": 84000,
    "categoria": "Metabolismo",
    "descripcion": "Mide los niveles de zinc en sangre. Su deficiencia afecta el sistema inmune, la cicatrización y el crecimiento.",
    "sintomas": ["cicatrización lenta", "pérdida del gusto", "pérdida del olfato", "infecciones frecuentes", "caída de cabello", "diarrea crónica", "retraso en crecimiento"]
  },
  {
    "codigo": "REMISION",
    "nombre": "ESTE PACIENTE TIENE EXAMENES DE REMISION",
    "precio": 90000,
    "categoria": "Otras",
    "descripcion": "Registro administrativo de exámenes enviados a laboratorio de referencia externo para análisis especializado.",
    "sintomas": []
  }
]
```

- [ ] **Step 2: Crear `backend/chatbot/examenes.json` con el mismo contenido**

Copiar el JSON completo del Step 1 a `backend/chatbot/examenes.json`. El contenido es idéntico.

- [ ] **Step 3: Verificar que el JSON es válido**

```bash
cd backend
python -c "import json; data = json.load(open('chatbot/examenes.json', encoding='utf-8')); print(f'OK — {len(data)} exámenes cargados')"
```

Resultado esperado: `OK — 89 exámenes cargados`

- [ ] **Step 4: Commit**

```bash
git add app/data/examenes.json backend/chatbot/examenes.json
git commit -m "feat(chatbot): enriquecer catálogo de exámenes con síntomas y categorías"
```

---

## Task 2: Scaffold Django app `chatbot`

**Files:**
- Create: `backend/chatbot/__init__.py`
- Create: `backend/chatbot/apps.py`
- Create: `backend/chatbot/urls.py`
- Modify: `backend/config/settings.py`
- Modify: `backend/config/urls.py`
- Modify: `backend/.env`

- [ ] **Step 1: Crear los archivos base de la app**

```bash
mkdir backend/chatbot
```

Crear `backend/chatbot/__init__.py` (vacío).

Crear `backend/chatbot/apps.py`:

```python
from django.apps import AppConfig


class ChatbotConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'chatbot'
    verbose_name = 'Chatbot Asistente'
```

Crear `backend/chatbot/urls.py` (temporalmente vacío, se completa en Task 3):

```python
from django.urls import path

urlpatterns = []
```

- [ ] **Step 2: Registrar la app y la API key en `backend/config/settings.py`**

En `INSTALLED_APPS`, después de `'empresas.apps.EmpresasConfig',` añadir:

```python
    'chatbot.apps.ChatbotConfig',
```

Al final del archivo, después de la sección `LOGGING`, añadir:

```python
# =============================================================================
# CHATBOT — Gemini 2.5 Flash
# =============================================================================
GEMINI_API_KEY = config('GEMINI_API_KEY', default='')
```

En la sección `LOGGING`, dentro del dict `'loggers'`, añadir después de `'resultados'`:

```python
        'chatbot': {
            'handlers': ['console', 'audit_file'],
            'level': 'INFO',
            'propagate': False,
        },
```

- [ ] **Step 3: Añadir `GEMINI_API_KEY` en `backend/.env`**

Añadir al final del archivo `.env`:

```
GEMINI_API_KEY=tu_api_key_aqui
```

Para obtener la API key: ir a https://aistudio.google.com/app/apikey y crear una nueva.

- [ ] **Step 4: Incluir las rutas del chatbot en `backend/config/urls.py`**

Añadir después de `path('api/', include('empresas.urls')),`:

```python
    path('api/', include('chatbot.urls')),
```

- [ ] **Step 5: Verificar que Django arranca sin errores**

```bash
cd backend
python manage.py check
```

Resultado esperado: `System check identified no issues (0 silenced).`

- [ ] **Step 6: Commit**

```bash
git add backend/chatbot/__init__.py backend/chatbot/apps.py backend/chatbot/urls.py backend/config/settings.py backend/config/urls.py
git commit -m "feat(chatbot): scaffold Django app chatbot con configuración Gemini"
```

---

## Task 3: Tests para el endpoint chatbot (TDD)

**Files:**
- Create: `backend/chatbot/tests.py`

- [ ] **Step 1: Crear `backend/chatbot/tests.py` con los tests**

```python
import json
from django.test import TestCase, Client
from unittest.mock import patch, MagicMock


class ChatbotViewTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.url = '/api/chatbot/'

    def test_missing_message_returns_400(self):
        response = self.client.post(
            self.url,
            data=json.dumps({}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.json())

    def test_empty_message_returns_400(self):
        response = self.client.post(
            self.url,
            data=json.dumps({'message': '   '}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.json())

    def test_invalid_json_body_returns_400(self):
        response = self.client.post(
            self.url,
            data='not-json',
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)

    @patch('chatbot.views._get_model')
    def test_valid_message_returns_response(self, mock_get_model):
        mock_model = MagicMock()
        mock_chat = MagicMock()
        mock_response = MagicMock()
        mock_response.text = 'Te recomendaría hacer Ferritina.'
        mock_chat.send_message.return_value = mock_response
        mock_model.start_chat.return_value = mock_chat
        mock_get_model.return_value = mock_model

        response = self.client.post(
            self.url,
            data=json.dumps({'message': 'tengo fatiga', 'history': []}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['response'], 'Te recomendaría hacer Ferritina.')

    @patch('chatbot.views._get_model')
    def test_history_is_truncated_to_20_items(self, mock_get_model):
        mock_model = MagicMock()
        mock_chat = MagicMock()
        mock_response = MagicMock()
        mock_response.text = 'respuesta'
        mock_chat.send_message.return_value = mock_response
        mock_model.start_chat.return_value = mock_chat
        mock_get_model.return_value = mock_model

        history = [
            {'role': 'user' if i % 2 == 0 else 'model', 'content': f'msg {i}'}
            for i in range(30)
        ]
        response = self.client.post(
            self.url,
            data=json.dumps({'message': 'hola', 'history': history}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        call_history = mock_model.start_chat.call_args[1]['history']
        self.assertEqual(len(call_history), 20)

    @patch('chatbot.views._get_model')
    def test_gemini_error_returns_503(self, mock_get_model):
        mock_model = MagicMock()
        mock_chat = MagicMock()
        mock_chat.send_message.side_effect = Exception('API error')
        mock_model.start_chat.return_value = mock_chat
        mock_get_model.return_value = mock_model

        response = self.client.post(
            self.url,
            data=json.dumps({'message': 'tengo fiebre'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 503)

    @patch('chatbot.views._get_model')
    def test_history_invalido_se_ignora(self, mock_get_model):
        """Si history no es lista, se procesa igual con historial vacío."""
        mock_model = MagicMock()
        mock_chat = MagicMock()
        mock_response = MagicMock()
        mock_response.text = 'respuesta'
        mock_chat.send_message.return_value = mock_response
        mock_model.start_chat.return_value = mock_chat
        mock_get_model.return_value = mock_model

        response = self.client.post(
            self.url,
            data=json.dumps({'message': 'hola', 'history': 'invalido'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        call_history = mock_model.start_chat.call_args[1]['history']
        self.assertEqual(call_history, [])
```

- [ ] **Step 2: Ejecutar los tests — deben fallar**

```bash
cd backend
python manage.py test chatbot.tests -v 2
```

Resultado esperado: error tipo `ImportError: cannot import name '_get_model' from 'chatbot.views'` o `ModuleNotFoundError`. Esto confirma que los tests están bien escritos y la implementación aún no existe.

- [ ] **Step 3: Commit de los tests**

```bash
git add backend/chatbot/tests.py
git commit -m "test(chatbot): añadir tests unitarios del endpoint chatbot (TDD)"
```

---

## Task 4: Implementar endpoint chatbot

**Files:**
- Create: `backend/chatbot/views.py`
- Modify: `backend/chatbot/urls.py`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Instalar `google-generativeai`**

```bash
cd backend
pip install google-generativeai
```

Añadir al final de `backend/requirements.txt`:

```
google-generativeai>=0.8.0
```

- [ ] **Step 2: Crear `backend/chatbot/views.py`**

```python
import json
import logging
from pathlib import Path

import google.generativeai as genai
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from ratelimit.decorators import ratelimit

logger = logging.getLogger('chatbot')

# Cargar catálogo una vez al importar el módulo
_EXAMENES_PATH = Path(__file__).parent / 'examenes.json'
with open(_EXAMENES_PATH, encoding='utf-8') as _f:
    _EXAMENES = json.load(_f)


def _build_system_prompt(examenes: list) -> str:
    lines = [
        "Eres el asistente virtual del Laboratorio Clínico BIOANALISIS, ubicado en Quibdó, Chocó, Colombia.",
        "",
        "Tu función es:",
        "1. Orientar a los usuarios sobre qué exámenes de laboratorio podrían ser útiles según sus síntomas.",
        "2. Explicar qué mide cada examen y qué significan los resultados de manera general.",
        "3. Responder preguntas generales sobre salud relacionadas con laboratorio clínico.",
        "",
        "Reglas estrictas:",
        "- NUNCA diagnostiques enfermedades. Solo orienta y recomienda exámenes.",
        "- Siempre indica que los resultados deben ser interpretados por un médico.",
        "- Solo recomienda exámenes que aparezcan en el catálogo provisto.",
        "- Si un examen tiene precio 1, indica 'consultar precio en recepción'.",
        "- Responde siempre en español, de manera amable, clara y profesional.",
        "- Cuando recomiendes exámenes, menciona el nombre y el precio en pesos colombianos (COP).",
        "- Si te preguntan algo completamente ajeno a salud o laboratorio, redirige amablemente.",
        "",
        "Catálogo de exámenes disponibles en BIOANALISIS:",
        "",
    ]
    for examen in examenes:
        precio = examen.get('precio', 0)
        precio_str = "Consultar en recepción" if precio <= 1 else f"${precio:,} COP"
        sintomas = ", ".join(examen.get('sintomas', []))
        lines.append(
            f"- {examen['nombre']} | Categoría: {examen.get('categoria', 'General')} | "
            f"Precio: {precio_str} | "
            f"Síntomas: {sintomas or 'ver descripción'} | "
            f"Descripción: {examen.get('descripcion', '')}"
        )
    return "\n".join(lines)


_SYSTEM_PROMPT = _build_system_prompt(_EXAMENES)
_MODEL = None


def _get_model():
    global _MODEL
    if _MODEL is None:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        _MODEL = genai.GenerativeModel(
            model_name='gemini-2.5-flash',
            system_instruction=_SYSTEM_PROMPT,
            generation_config={
                'max_output_tokens': 1024,
                'temperature': 0.4,
            },
        )
    return _MODEL


@csrf_exempt
@require_POST
@ratelimit(key='ip', rate='30/h', method='POST', block=False)
def chatbot_view(request):
    if getattr(request, 'limited', False):
        return JsonResponse(
            {'error': 'Demasiadas consultas. Intenta en unos minutos.'},
            status=429,
        )

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({'error': "El campo 'message' es requerido."}, status=400)

    message = (body.get('message') or '').strip()
    if not message:
        return JsonResponse({'error': "El campo 'message' es requerido."}, status=400)

    history = body.get('history', [])
    if not isinstance(history, list):
        history = []

    # Tomar máximo los últimos 20 items (10 intercambios)
    history = history[-20:]

    gemini_history = [
        {'role': msg['role'], 'parts': [msg.get('content', '')]}
        for msg in history
        if msg.get('role') in ('user', 'model') and msg.get('content')
    ]

    try:
        model = _get_model()
        chat = model.start_chat(history=gemini_history)
        response = chat.send_message(message)
        logger.info("Chatbot OK | ip=%s | chars_respuesta=%d", request.META.get('REMOTE_ADDR'), len(response.text))
        return JsonResponse({'response': response.text})
    except Exception as e:
        logger.error("Chatbot Gemini error: %s", str(e))
        return JsonResponse(
            {'error': 'Servicio no disponible. Intenta de nuevo.'},
            status=503,
        )
```

- [ ] **Step 3: Actualizar `backend/chatbot/urls.py`**

```python
from django.urls import path
from .views import chatbot_view

urlpatterns = [
    path('chatbot/', chatbot_view, name='chatbot'),
]
```

- [ ] **Step 4: Ejecutar los tests — deben pasar**

```bash
cd backend
python manage.py test chatbot.tests -v 2
```

Resultado esperado:
```
test_empty_message_returns_400 ... ok
test_gemini_error_returns_503 ... ok
test_history_invalido_se_ignora ... ok
test_history_is_truncated_to_20_items ... ok
test_invalid_json_body_returns_400 ... ok
test_missing_message_returns_400 ... ok
test_valid_message_returns_response ... ok

Ran 7 tests in X.XXXs
OK
```

- [ ] **Step 5: Ejecutar todos los tests del proyecto**

```bash
cd backend
python manage.py test -v 2
```

Resultado esperado: todos `OK`.

- [ ] **Step 6: Verificar que Django arranca sin errores**

```bash
cd backend
python manage.py check
```

Resultado esperado: `System check identified no issues (0 silenced).`

- [ ] **Step 7: Commit**

```bash
git add backend/chatbot/views.py backend/chatbot/urls.py backend/requirements.txt
git commit -m "feat(chatbot): implementar endpoint POST /api/chatbot/ con Gemini 2.5 Flash"
```

---

## Task 5: Frontend — ChatbotWidget.tsx

**Files:**
- Create: `components/ChatbotWidget.tsx`

**Contexto CSS existente:**
- `.floating-btn`: `position: fixed; right: 20px; z-index: 1000; width: 60px; height: 60px`
- `.whatsapp-btn`: `bottom: 20px`
- `.instagram-btn`: `bottom: 90px`
- El chatbot irá en `bottom: 160px` (sobre ambos botones sociales)

- [ ] **Step 1: Crear `components/ChatbotWidget.tsx`**

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface Message {
  role: 'user' | 'model';
  content: string;
}

const WELCOME: Message = {
  role: 'model',
  content:
    'Hola, soy el asistente virtual de BIOANALISIS. Cuéntame tus síntomas y te orientaré sobre qué exámenes podrían serte útiles. Recuerda que mis recomendaciones no reemplazan la consulta médica.',
};

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/chatbot/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages, // historial completo incluyendo bienvenida
        }),
      });
      const data = (await res.json()) as { response?: string; error?: string };
      const botContent = res.ok
        ? (data.response ?? 'Sin respuesta del asistente.')
        : (data.error ?? 'Error al procesar tu consulta.');
      setMessages([...updated, { role: 'model', content: botContent }]);
    } catch {
      setMessages([
        ...updated,
        { role: 'model', content: 'No se pudo conectar con el asistente. Verifica tu conexión.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <>
      {/* Panel del chat */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '20px',
            width: '360px',
            height: '500px',
            background: '#fff',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9999,
            overflow: 'hidden',
            fontFamily: 'inherit',
          }}
        >
          {/* Header */}
          <div
            style={{
              background: 'var(--primary-blue, #0066cc)',
              color: '#fff',
              padding: '14px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fas fa-comment-medical" style={{ fontSize: '1rem' }} />
              <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
                Asistente BIOANALISIS
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '1rem',
                padding: '4px',
              }}
              aria-label="Cerrar chat"
            >
              <i className="fas fa-times" />
            </button>
          </div>

          {/* Mensajes */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '82%',
                  background:
                    msg.role === 'user' ? 'var(--primary-blue, #0066cc)' : '#f1f3f5',
                  color: msg.role === 'user' ? '#fff' : '#333',
                  padding: '10px 14px',
                  borderRadius:
                    msg.role === 'user'
                      ? '16px 16px 4px 16px'
                      : '16px 16px 16px 4px',
                  fontSize: '0.87rem',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {msg.content}
              </div>
            ))}
            {loading && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  background: '#f1f3f5',
                  color: '#888',
                  padding: '10px 18px',
                  borderRadius: '16px 16px 16px 4px',
                  fontSize: '1.3rem',
                  letterSpacing: '4px',
                }}
              >
                ···
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid #eee',
              display: 'flex',
              gap: '8px',
              flexShrink: 0,
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={loading}
              placeholder="Describe tus síntomas..."
              style={{
                flex: 1,
                padding: '10px 14px',
                border: '1px solid #ddd',
                borderRadius: '20px',
                fontSize: '0.87rem',
                outline: 'none',
                background: loading ? '#f8f8f8' : '#fff',
              }}
            />
            <button
              onClick={() => void sendMessage()}
              disabled={loading || !input.trim()}
              style={{
                background: 'var(--primary-blue, #0066cc)',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: loading || !input.trim() ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'opacity 0.2s',
              }}
              aria-label="Enviar mensaje"
            >
              <i className="fas fa-paper-plane" style={{ fontSize: '0.85rem' }} />
            </button>
          </div>
        </div>
      )}

      {/* Botón flotante */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          position: 'fixed',
          bottom: '160px',
          right: '20px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'var(--primary-blue, #0066cc)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          zIndex: 1000,
          transition: 'transform 0.3s, box-shadow 0.3s',
        }}
        aria-label={isOpen ? 'Cerrar asistente' : 'Abrir asistente virtual'}
        title="Asistente virtual BIOANALISIS"
      >
        <i className={`fas ${isOpen ? 'fa-times' : 'fa-comment-medical'}`} />
      </button>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ChatbotWidget.tsx
git commit -m "feat(chatbot): crear ChatbotWidget flotante con Gemini multi-turno"
```

---

## Task 6: Integrar widget en layout y prueba manual

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Añadir `ChatbotWidget` en `app/layout.tsx`**

Añadir el import después de `import FloatingButtons from "@/components/FloatingButtons";`:

```typescript
import ChatbotWidget from "@/components/ChatbotWidget";
```

Añadir `<ChatbotWidget />` justo después de `<FloatingButtons />` dentro del `<body>`:

```typescript
      <body>
        <Navbar />
        <main>{children}</main>
        <Footer />
        <FloatingButtons />
        <ChatbotWidget />
      </body>
```

- [ ] **Step 2: Arrancar el servidor de desarrollo y verificar visualmente**

En una terminal arrancar el backend:
```bash
cd backend && python manage.py runserver
```

En otra terminal arrancar el frontend:
```bash
npm run dev
```

Abrir `http://localhost:3000` y verificar:
- [ ] El botón azul con ícono `fa-comment-medical` aparece en `bottom: 160px, right: 20px` (sobre los botones de WhatsApp e Instagram)
- [ ] Al hacer clic, se abre el panel de chat con el mensaje de bienvenida
- [ ] Al escribir un síntoma y enviar, aparece la burbuja de carga `···` y luego la respuesta de Gemini
- [ ] El historial se mantiene durante la sesión (multi-turno funciona)
- [ ] Al cerrar y reabrir el widget, el historial se reinicia con el mensaje de bienvenida
- [ ] Los botones de WhatsApp e Instagram siguen funcionando y no se solapan con el chatbot

- [ ] **Step 3: Probar en la URL del AnyDesk (red local)**

En el servidor de la clínica, hacer `git pull origin develop`, reiniciar Django y el frontend. Verificar que el chatbot aparece y responde correctamente.

- [ ] **Step 4: Commit final**

```bash
git add app/layout.tsx
git commit -m "feat(chatbot): integrar ChatbotWidget en layout global — disponible en todas las páginas"
```
