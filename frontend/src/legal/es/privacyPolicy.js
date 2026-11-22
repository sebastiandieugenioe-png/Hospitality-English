// Spanish translation of ../privacyPolicy.js. Keep both in sync.
export const privacyPolicy = {
  title: "Política de privacidad",
  updated: "Última actualización: 22 de noviembre de 2026. En vigor desde el 22 de noviembre de 2026.",
  intro: [
    "Esta Política de privacidad explica qué datos personales trata Inglés para Hostelería (\"Hospitality English\", \"la app\", \"nosotros\"), para qué y qué opciones tienes. Se aplica a la web app y a las apps móviles que usan el mismo servicio.",
  ],
  sections: [
    {
      h: "1. Responsable",
      p: [
        "El servicio lo opera Sebastian Di Eugenio, trabajador autónomo con sede en Irlanda (con el nombre comercial English to Work), que es el responsable del tratamiento.",
        "Dirección: 4 Emmet Road, Dublin D08 F8W3, Irlanda.",
        "Contacto de privacidad: info@englishtowork.app.",
      ],
    },
    {
      h: "2. Usar la app sin cuenta",
      p: [
        "Puedes usar la app sin crear una cuenta. Al abrirla creamos un perfil de invitado para guardar tu progreso. Ese perfil se identifica con un ID aleatorio guardado en tu dispositivo y con un ID anónimo de nuestro proveedor de autenticación (Firebase). No está vinculado a tu nombre ni a tu email, pero sigue siendo información sobre cómo usas la app, así que lo tratamos como dato personal.",
        "Los datos de invitado se guardan en nuestros servidores. Si más adelante inicias sesión con Google o Apple, tu perfil de invitado y tu progreso se vinculan a tu nueva cuenta.",
      ],
    },
    {
      h: "3. Datos que tratamos",
      list: [
        "Datos de cuenta (solo si inicias sesión con Google o Apple): email y nombre que facilita el proveedor de inicio de sesión, el método usado, un ID interno de cuenta y fechas de la cuenta (creación, actualización, último inicio de sesión).",
        "Perfil y preferencias: idioma de la interfaz, tu puesto (por ejemplo, bartender o camarero), tipo de local, el país donde quieres trabajar, tu objetivo, tu situación laboral y, si lo indicas, tu nivel de inglés.",
        "Actividad de aprendizaje: lecciones empezadas y completadas, respuestas y puntuaciones, elementos de repaso, resultados de evaluaciones, progreso en Turno de esta noche, Entrevista de trabajo y Primera semana, y respuestas de Listening.",
        "Práctica de Speaking: tu grabación de voz (tratada de forma temporal, ver sección 5), la transcripción de lo que dijiste, la evaluación y los comentarios generados, y la duración de la grabación.",
        "Estado de la suscripción: si tienes Premium, qué plan y los registros de compra que gestiona RevenueCat (ver sección 6). No recibimos ni guardamos los datos completos de tu tarjeta.",
        "Comentarios que nos envías: la categoría y el mensaje que escribes, junto con la versión de la app y la pantalla en la que estabas.",
        "Eventos de cuenta: registros de inicios de sesión y vinculación de cuentas (tipo de evento, método, IDs internos y hora).",
        "Datos guardados en tu dispositivo: un ID de invitado, tu idioma, un borrador del onboarding, un ID anónimo de RevenueCat y la posición de desplazamiento, guardados en el almacenamiento local del navegador para que la app funcione.",
        "Datos técnicos de conexión (como la dirección IP) que reciben nuestros proveedores de alojamiento y de tipografías cuando tu dispositivo se conecta.",
      ],
    },
    {
      h: "4. Para qué usamos tus datos",
      list: [
        "Para prestar el servicio: guardar tu progreso, mostrarte tus lecciones y prácticas y mantener tu cuenta en todos tus dispositivos (ejecución de un contrato).",
        "Para personalizar recomendaciones según tu puesto, local, país y objetivo (ejecución de un contrato).",
        "Para evaluar tus respuestas de Speaking y darte comentarios (ejecución de un contrato).",
        "Para gestionar el acceso Premium y las suscripciones (ejecución de un contrato).",
        "Para mantener el servicio seguro, evitar abusos y registrar cambios en la cuenta (interés legítimo).",
        "Para leer tus comentarios y mejorar la app (interés legítimo).",
      ],
      p: ["No vendemos tus datos personales ni los usamos para publicidad."],
    },
    {
      h: "5. La práctica de Speaking y tu voz",
      p: [
        "Cuando grabas una respuesta de Speaking, el audio se envía a nuestro servidor y de ahí a ElevenLabs para convertirlo en texto. Nuestro servidor solo mantiene el audio en memoria mientras se transcribe y después lo descarta; no guardamos tu grabación.",
        "La transcripción resultante (solo texto, sin tu nombre ni tu email) se envía a OpenAI para evaluar tu respuesta. Guardamos la transcripción y la evaluación con tu progreso para que puedas ver tus resultados.",
        "ElevenLabs y OpenAI tratan estos datos por encargo nuestro como proveedores de servicios. Lo que ellos conserven se rige por sus propias condiciones y ajustes, que esta app no controla.",
        "Los audios de Listening son contenido pregrabado y no usan tus datos.",
      ],
    },
    {
      h: "6. Inicio de sesión y suscripciones",
      p: [
        "El inicio de sesión lo presta Firebase Authentication (Google), con Google Sign-In e Iniciar sesión con Apple. Estos proveedores tratan tus datos de inicio de sesión según sus propias políticas de privacidad.",
        "Las suscripciones se gestionan con RevenueCat, que registra tus compras y tu acceso Premium asociados a tu ID interno de cuenta (antes de iniciar sesión se usa un ID anónimo). Los pagos los procesa la pasarela de RevenueCat o, en las apps móviles, Apple App Store o Google Play. No recibimos los datos completos de tu tarjeta.",
      ],
    },
    {
      h: "7. Analítica",
      p: [
        "La app no usa herramientas de analítica, publicidad ni grabación de sesiones, y no te sigue en otras apps o webs. La herramienta de analítica de nuestra plataforma de alojamiento solo está activa en nuestro entorno interno de pruebas, que no usan los usuarios de la app.",
      ],
    },
    {
      h: "8. Proveedores de servicios",
      list: [
        "Google (Firebase Authentication, Google Sign-In, Google Fonts): autenticación; las tipografías se cargan desde servidores de Google, que reciben tu dirección IP.",
        "Apple (Iniciar sesión con Apple): autenticación.",
        "RevenueCat: gestión de suscripciones y acceso Premium.",
        "ElevenLabs: conversión de voz a texto en la práctica de Speaking (audio).",
        "OpenAI: evaluación de las transcripciones de Speaking (texto).",
        "Emergent y sus proveedores de infraestructura: alojamiento de la app, el servidor y la base de datos.",
      ],
      p: ["Algunos de estos proveedores pueden tratar datos fuera de tu país, incluso fuera del Espacio Económico Europeo. En ese caso, la transferencia se basa en una decisión de adecuación de la Comisión Europea (incluido el Marco de Privacidad de Datos UE-EE. UU. cuando el proveedor está certificado) o en las Cláusulas Contractuales Tipo incluidas en las condiciones de tratamiento de datos del proveedor."],
    },
    {
      h: "9. Cuánto tiempo guardamos los datos",
      list: [
        "Datos de cuenta, perfil y aprendizaje: hasta que borres tu cuenta.",
        "Datos de invitado sin cuenta: se guardan en nuestros servidores; ahora mismo no caducan automáticamente. Puedes pedirnos que los borremos (sección 10).",
        "Audio de Speaking: no lo guardamos; se descarta tras la transcripción.",
        "Registros de eventos de cuenta (inicios de sesión y vinculación): hasta que borres tu cuenta.",
        "Registros de suscripción en RevenueCat y en las tiendas de apps: los conservan ellos según sus políticas y obligaciones legales (por ejemplo, fiscales).",
      ],
    },
    {
      h: "10. Borrar tu cuenta y tus datos",
      p: [
        "Puedes borrar tu cuenta en la app: Más → Cuenta → Borrar cuenta. Esto borra para siempre tu cuenta, tu perfil, tus datos de aprendizaje (incluidas las transcripciones y evaluaciones de Speaking), los comentarios vinculados a tu perfil, tus registros de eventos de cuenta y tu registro de inicio de sesión en Firebase. Si iniciaste sesión con Apple, también revocamos el acceso de la app a tu Apple ID.",
        "Esta acción no borra los registros de compra que conservan RevenueCat o las tiendas de apps.",
        "También puedes hacerlo desde cualquier navegador, o pedir el borrado si no puedes iniciar sesión, como se explica en /account-deletion.",
      ],
    },
    {
      h: "11. Tus derechos",
      p: [
        "Según donde vivas (por ejemplo, con el RGPD de la UE o del Reino Unido), puedes tener derecho a acceder a tus datos, corregirlos, borrarlos, limitar u oponerte a su tratamiento y recibir una copia en un formato portable. Puedes cambiar tu perfil y tu idioma en la app y borrar tu cuenta cuando quieras. Para cualquier otra solicitud, escríbenos a info@englishtowork.app; te responderemos en el plazo de un mes. También tienes derecho a reclamar ante la Comisión de Protección de Datos de Irlanda (www.dataprotection.ie) o ante la autoridad de protección de datos del país donde vives.",
      ],
    },
    {
      h: "12. Menores",
      p: ["La app está pensada para adultos que trabajan o quieren trabajar en hostelería. Debes tener al menos 16 años para usarla."],
    },
    {
      h: "13. Seguridad",
      p: ["Aplicamos medidas técnicas y organizativas razonables para proteger tus datos, como el acceso autenticado a las funciones de cuenta y la protección de las claves del servidor. Ningún servicio en línea es completamente seguro."],
    },
    {
      h: "14. Cambios",
      p: ["Podemos actualizar esta política. Cambiaremos la fecha de arriba y, si los cambios son importantes, te avisaremos en la app."],
    },
  ],
};
