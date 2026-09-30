const API_URL = "https://script.google.com/macros/s/AKfycbz0GR3bcvVC-pUzmOjw2NUN71H3S-91ClSwfWfePkAKaujnyo3biYOo9I7oWFAVIGWO/exec";

let filaActual = null;
let inscripcionesAbiertas = true;
let fechaLimite = null;
let procesando = false;
let datosGimnastaActual = null;

document.addEventListener("DOMContentLoaded", async function() {
  crearContenedorToast();
  crearOverlayProcesando();
  await cargarConfiguracion();
  manejarRetornoMP();
});

function crearContenedorToast() {
  if (!document.getElementById("toastContainer")) {
    const container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
}

function crearOverlayProcesando() {
  if (!document.getElementById("overlayProcesando")) {
    const overlay = document.createElement("div");
    overlay.id = "overlayProcesando";
    overlay.className = "overlay-procesando";
    overlay.innerHTML = `
      <div class="procesando-card">
        <div class="spinner"></div>
        <div class="procesando-texto">Procesando...</div>
        <div class="procesando-subtexto">Por favor, espere un momento</div>
      </div>
    `;
    document.body.appendChild(overlay);
  }
}

function mostrarProcesando(mostrar) {
  const overlay = document.getElementById("overlayProcesando");
  if (overlay) {
    if (mostrar) {
      overlay.classList.add("activo");
      procesando = true;
      const btnGuardar = document.querySelector(".btn-guardar");
      if (btnGuardar) btnGuardar.disabled = true;
    } else {
      overlay.classList.remove("activo");
      procesando = false;
      const btnGuardar = document.querySelector(".btn-guardar");
      if (btnGuardar) btnGuardar.disabled = false;
    }
  }
}

function mostrarToast(tipo, titulo, mensaje, duracion = 4000) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const iconos = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };
  const titulosDefault = { success: "¡Éxito!", error: "Error", warning: "Atención", info: "Información" };

  const toast = document.createElement("div");
  toast.className = `toast ${tipo}`;
  toast.innerHTML = `
    <div class="toast-icon">${iconos[tipo] || "ℹ️"}</div>
    <div class="toast-contenido">
      <div class="toast-titulo">${titulo || titulosDefault[tipo]}</div>
      <div class="toast-mensaje">${mensaje}</div>
    </div>
    <button class="toast-cerrar" onclick="cerrarToast(this.parentElement)">✕</button>
    <div class="toast-barra"></div>
  `;

  container.appendChild(toast);
  setTimeout(() => cerrarToast(toast), duracion);
}

function cerrarToast(toast) {
  if (!toast || toast.classList.contains("saliendo")) return;
  toast.classList.add("saliendo");
  setTimeout(() => {
    if (toast.parentElement) toast.parentElement.removeChild(toast);
  }, 300);
}

async function cargarConfiguracion() {
  try {
    const config = await llamarAPI("obtenerDatos", {});
    
    if (config.error) {
      console.error("Error al cargar configuración:", config.error);
      mostrarToast("error", "Error de configuración", config.error);
      return;
    }

    // Cargar información del evento
    setTexto("infoTorneo", config.titulo_torneo);
    setTexto("infoClub", config.club);
    setTexto("infoFechaEvento", config.fecha_evento);
    setTexto("infoTitulo3", config.titulo3);
    setTexto("infoTitulo4", config["titulo 4"]);
    setTexto("infoFechaLimite", formatearFechaParaMostrar(config.fecha_limite_formateada));

    // Título de la pestaña
    if (config.titulo_torneo) {
      document.title = "Confirmación de Asistencia - " + config.titulo_torneo;
    }

    // Estado de inscripciones
    inscripcionesAbiertas = config.inscripciones_abiertas;
    fechaLimite = config.fecha_limite_formateada;

    if (!inscripcionesAbiertas) {
      bloquearFormulario(fechaLimite);
    }

  } catch (error) {
    console.error("Error al cargar configuración:", error);
    mostrarToast("error", "Error de conexión", "No se pudo cargar la configuración. Recargue la página.");
  }
}

function bloquearFormulario(fechaLimiteFormateada) {
  const bloque = document.getElementById("bloqueInscripciones");
  const fechaEl = document.getElementById("fechaLimiteMostrada");
  const contenido = document.getElementById("contenidoPrincipal");
  
  if (bloque) bloque.classList.remove("hidden");
  if (fechaEl) fechaEl.textContent = formatearFechaParaMostrar(fechaLimiteFormateada);
  if (contenido) contenido.classList.add("hidden");
  
  setTimeout(() => {
    mostrarToast("warning", "Inscripciones cerradas", "El plazo de inscripción ha vencido. Comuníquese con el coordinador.", 6000);
  }, 500);
}

function formatearFechaParaMostrar(fechaStr) {
  if (!fechaStr) return "";
  const partes = fechaStr.split("-");
  if (partes.length !== 3) return fechaStr;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function setTexto(id, texto) {
  const elemento = document.getElementById(id);
  if (elemento) {
    elemento.textContent = texto || "";
  }
}

async function llamarAPI(accion, payload = {}) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ accion, ...payload })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Respuesta cruda del servidor:", errorText);
      throw new Error(`Error del servidor (Status ${response.status}).`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error en llamarAPI:", error);
    throw error;
  }
}

async function buscar() {
  if (procesando) return;

  if (!inscripcionesAbiertas) {
    mostrarToast("warning", "Inscripciones cerradas", "El plazo de inscripción ha vencido. Comuníquese con el coordinador.");
    return;
  }

  const documentoInput = document.getElementById("documento").value.trim();
  
  if (!documentoInput) {
    mostrarToast("error", "Campo requerido", "Por favor, ingrese el número de documento.");
    return;
  }

  if (!/^\d+$/.test(documentoInput)) {
    mostrarToast("error", "Documento inválido", "El documento debe contener solo números.");
    return;
  }

  if (documentoInput.length < 7) {
    mostrarToast("error", "Documento inválido", "El documento debe tener al menos 7 dígitos.");
    return;
  }

  mostrarMensaje("Buscando información...", "info");
  mostrarProcesando(true);

  try {
    const resultado = await llamarAPI("buscar", { documento: documentoInput });
    
    const formulario = document.getElementById("formulario");
    if (formulario) formulario.classList.remove("hidden");

    if (resultado.encontrado) {
      filaActual = resultado.fila;
      
      const estado = resultado.datos.estadoPago || "PENDIENTE";
      if (estado === "PAGADA" || estado === "PAGADO") {
        mostrarToast("success", "Gimnasta encontrada", "Su inscripción está completa y acreditada. ✅");
      } else {
        mostrarToast("info", "Gimnasta encontrada", "Ya existe una inscripción pendiente de pago. Puede pagar ahora o editar los datos.");
      }
      
      cargarDatos(resultado.datos);
      
      setTimeout(() => {
        const tarjeta = document.getElementById("tarjetaEstadoPago");
        if (tarjeta) tarjeta.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 400);
      
    } else {
      filaActual = null;
      mostrarMensaje("🟢 No encontramos este documento. Puede registrar una nueva gimnasta.", "success");
      mostrarToast("info", "Gimnasta no registrada", "Complete el formulario para realizar una nueva inscripción.");
      limpiarFormulario();
    }
  } catch (error) {
    console.error("Error en buscar:", error);
    mostrarMensaje("Error: " + error.message, "error");
    mostrarToast("error", "Error", error.message);
  } finally {
    mostrarProcesando(false);
  }
}

function cargarDatos(datos) {
  const docEl = document.getElementById("documento");
  const nombreEl = document.getElementById("nombre");
  const apellidoEl = document.getElementById("apellido");
  const fechaEl = document.getElementById("fechaNacimiento");
  const datosGimnasta = document.getElementById("datosGimnasta");
  
  if (docEl) docEl.value = datos.documento || "";
  if (nombreEl) nombreEl.value = datos.nombre || "";
  if (apellidoEl) apellidoEl.value = datos.apellido || "";
  
  const fechaNormalizada = normalizarFecha(datos.fechaNacimiento);
  if (fechaEl) fechaEl.value = fechaNormalizada;
  
  const radioSi = document.querySelector('input[name="puedeAsistir"][value="SI"]');
  const radioNo = document.querySelector('input[name="puedeAsistir"][value="NO"]');
  
  if (datos.puedeAsistir === "SI" && radioSi) radioSi.checked = true;
  else if (datos.puedeAsistir === "NO" && radioNo) radioNo.checked = true;
  
  const consentimiento = document.getElementById("consentimiento");
  if (consentimiento) consentimiento.checked = datos.consentimiento === "SI";
  
  if (datosGimnasta) datosGimnasta.classList.remove("hidden");
  
  if (fechaNormalizada) {
    actualizarCategoriaVisual(determinarCategoriaPorEdad(fechaNormalizada));
  } else {
    actualizarCategoriaVisual("");
  }
  
  // Guardamos ambos por separado y también juntos para Mercado Pago
  datosGimnastaActual = {
    documento: datos.documento,
    nombre: datos.nombre,
    apellido: datos.apellido,
    nombreCompleto: `${datos.nombre || ""} ${datos.apellido || ""}`.trim(),
    categoria: determinarCategoriaPorEdad(fechaNormalizada),
    fechaNacimiento: fechaNormalizada
  };
  
  mostrarTarjetaEstadoPago(datos.estadoPago || "PENDIENTE");
}

function mostrarTarjetaEstadoPago(estado) {
  const tarjeta = document.getElementById("tarjetaEstadoPago");
  if (!tarjeta) return;
  
  const badge = document.getElementById("estadoBadge");
  const estadoTexto = document.getElementById("estadoTexto");
  const estadoIcon = document.getElementById("estadoIcon");
  const estadoTitulo = document.getElementById("estadoTitulo");
  const estadoSubtitulo = document.getElementById("estadoSubtitulo");
  const accionPago = document.getElementById("accionPago");
  const accionPagado = document.getElementById("accionPagado");
  
  tarjeta.classList.remove("hidden");
  
  if (badge) badge.classList.remove("pendiente", "pagado");
  if (accionPago) accionPago.classList.add("hidden");
  if (accionPagado) accionPagado.classList.add("hidden");
  
  if (estado === "PAGADA" || estado === "PAGADO") {
    if (badge) badge.classList.add("pagado");
    if (estadoTexto) estadoTexto.textContent = "PAGO ACREDITADO";
    if (estadoIcon) estadoIcon.textContent = "✅";
    if (estadoTitulo) estadoTitulo.textContent = "Inscripción completa";
    if (estadoSubtitulo) estadoSubtitulo.textContent = "Su pago fue acreditado correctamente";
    if (accionPagado) accionPagado.classList.remove("hidden");
  } else {
    if (badge) badge.classList.add("pendiente");
    if (estadoTexto) estadoTexto.textContent = "PAGO PENDIENTE";
    if (estadoIcon) estadoIcon.textContent = "⏳";
    if (estadoTitulo) estadoTitulo.textContent = "Inscripción registrada";
    if (estadoSubtitulo) estadoSubtitulo.textContent = "Falta completar el pago para confirmar";
    if (accionPago) accionPago.classList.remove("hidden");
  }
}

function normalizarFecha(fecha) {
  if (!fecha) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
  
  const partesSlash = fecha.split("/");
  if (partesSlash.length === 3) {
    return `${partesSlash[2]}-${partesSlash[1].padStart(2, "0")}-${partesSlash[0].padStart(2, "0")}`;
  }
  
  try {
    const dateObj = new Date(fecha);
    if (!isNaN(dateObj.getTime())) {
      const anio = dateObj.getFullYear();
      const mes = String(dateObj.getMonth() + 1).padStart(2, "0");
      const dia = String(dateObj.getDate()).padStart(2, "0");
      return `${anio}-${mes}-${dia}`;
    }
  } catch (e) {
    console.error("No se pudo normalizar la fecha:", fecha);
  }
  return "";
}

function cambiarAsistencia() {
  const radioSi = document.querySelector('input[name="puedeAsistir"][value="SI"]');
  const valor = radioSi && radioSi.checked ? "SI" : "NO";
  const datos = document.getElementById("datosGimnasta");
  if (datos) {
    if (valor === "SI") datos.classList.remove("hidden");
    else datos.classList.add("hidden");
  }
}

function calcularCategoria() {
  const fecha = document.getElementById("fechaNacimiento").value;
  if (!fecha) {
    actualizarCategoriaVisual("");
    return;
  }
  actualizarCategoriaVisual(determinarCategoriaPorEdad(fecha));
}

function determinarCategoriaPorEdad(fechaNacimientoStr) {
  if (!fechaNacimientoStr) return "";
  const partes = fechaNacimientoStr.split("-");
  if (partes.length !== 3) return "Formato de fecha inválido";

  const anioNac = parseInt(partes[0], 10);
  const anioActual = new Date().getFullYear();
  const edad = anioActual - anioNac;

  if (edad < 0) return "Edad inválida";

  const categorias = [
    { edadMinima: 3, categoria: "Piojos" },
    { edadMinima: 5, categoria: "Pulgas" },
    { edadMinima: 6, categoria: "Pre Mini" },
    { edadMinima: 8, categoria: "Mini" },
    { edadMinima: 10, categoria: "Pre Infantil" },
    { edadMinima: 12, categoria: "Infantil" },
    { edadMinima: 14, categoria: "Juvenil" },
    { edadMinima: 16, categoria: "Mayor" }
  ];

  for (let i = 0; i < categorias.length; i++) {
    const edadMinima = categorias[i].edadMinima;
    const categoria = categorias[i].categoria;
    if (i === categorias.length - 1) {
      if (edad >= edadMinima) return categoria;
    } else {
      const edadMaxima = categorias[i + 1].edadMinima - 1;
      if (edad >= edadMinima && edad <= edadMaxima) return categoria;
    }
  }

  if (edad < categorias[0].edadMinima) return "Sin categoría (menor de 3 años)";
  return "SIN CATEGORÍA";
}

function actualizarCategoriaVisual(categoria) {
  const el = document.getElementById("categoria");
  if (el) el.innerHTML = "Categoría: <strong>" + (categoria || "-") + "</strong>";
}

async function guardar() {
  if (procesando) {
    mostrarToast("info", "Procesando", "Ya se está procesando su solicitud. Por favor espere.");
    return;
  }

  if (!inscripcionesAbiertas) {
    mostrarToast("warning", "Inscripciones cerradas", "El plazo de inscripción ha vencido. Comuníquese con el coordinador.");
    return;
  }

  const radioSi = document.querySelector('input[name="puedeAsistir"][value="SI"]');
  const radioNo = document.querySelector('input[name="puedeAsistir"][value="NO"]');
  
  if (!radioSi || !radioNo || (!radioSi.checked && !radioNo.checked)) {
    mostrarToast("error", "Campo requerido", "Debe seleccionar si puede asistir o no.");
    return;
  }
  
  const puedeAsistir = radioSi.checked ? "SI" : "NO";
  if (puedeAsistir !== "SI") {
    mostrarToast("warning", "Asistencia requerida", "Debe confirmar que puede asistir para continuar con la inscripción.");
    return;
  }

  // LEEMOS LOS DOS CAMPOS POR SEPARADO
  const nombre = document.getElementById("nombre").value.trim();
  const apellido = document.getElementById("apellido").value.trim();
  const fechaNacimiento = document.getElementById("fechaNacimiento").value;

  if (!nombre || !apellido || !fechaNacimiento) {
    mostrarToast("error", "Datos incompletos", "Complete nombre, apellido y fecha de nacimiento.");
    return;
  }

  const consentimiento = document.getElementById("consentimiento").checked;
  if (!consentimiento) {
    mostrarToast("warning", "Consentimiento requerido", "Debe leer y aceptar las indicaciones.");
    return;
  }

  const documento = document.getElementById("documento").value;
const categoria = determinarCategoriaPorEdad(fechaNacimiento);

const datos = {
  documento, 
  nombre, 
  apellido, 
  fechaNacimiento, 
  categoria, // ← AGREGADO: enviamos la categoría ya calculada
  puedeAsistir, 
  consentimiento: true
};

  // Guardamos para el pago
  datosGimnastaActual = {
    documento,
    nombre,
    apellido,
    nombreCompleto: `${nombre} ${apellido}`,
    categoria,
    fechaNacimiento
  };

  mostrarProcesando(true);

  try {
    const resultado = await llamarAPI("guardar", { datos });
    
    if (resultado.actualizado) {
      mostrarToast("success", "Datos actualizados", "Los datos fueron actualizados correctamente.");
    } else {
      mostrarToast("success", "¡Inscripción registrada!", "La inscripción fue registrada correctamente.");
    }

    mostrarVistaConfirmacion({
      nombreCompleto: `${nombre} ${apellido}`,
      documento,
      fechaNacimiento,
      categoria,
      estadoPago: resultado.estadoPago || "PENDIENTE"
    });
    
  } catch (error) {
    mostrarToast("error", "Error al guardar", "No se pudo guardar la información: " + error.message);
  } finally {
    mostrarProcesando(false);
  }
}

function mostrarVistaConfirmacion(datos) {
  const formCard = document.getElementById("formCard");
  const vista = document.getElementById("vistaConfirmacion");
  
  if (formCard) formCard.classList.add("hidden");
  if (vista) vista.classList.remove("hidden");
  
  const confNombre = document.getElementById("confNombreCompleto");
  const confDoc = document.getElementById("confDocumento");
  const confFecha = document.getElementById("confFechaNac");
  const confCat = document.getElementById("confCategoria");
  
  if (confNombre) confNombre.textContent = datos.nombreCompleto || "-";
  if (confDoc) confDoc.textContent = formatearDocumento(datos.documento);
  if (confFecha) confFecha.textContent = formatearFechaParaMostrar(datos.fechaNacimiento);
  if (confCat) confCat.textContent = datos.categoria || "-";
  
  const badge = document.getElementById("confEstadoBadge");
  const icon = document.getElementById("confEstadoIcon");
  const accionPagar = document.getElementById("confAccionPagar");
  const accionPagado = document.getElementById("confAccionPagado");
  
  if (badge) badge.classList.remove("pagado");
  if (accionPagar) accionPagar.classList.add("hidden");
  if (accionPagado) accionPagado.classList.add("hidden");
  
  if (datos.estadoPago === "PAGADA" || datos.estadoPago === "PAGADO") {
    if (badge) {
      badge.textContent = "PAGO ACREDITADO";
      badge.classList.add("pagado");
    }
    if (icon) icon.textContent = "✅";
    if (accionPagado) accionPagado.classList.remove("hidden");
  } else {
    if (badge) badge.textContent = "PAGO PENDIENTE";
    if (icon) icon.textContent = "⏳";
    if (accionPagar) accionPagar.classList.remove("hidden");
  }
  
  setTimeout(() => {
    if (vista) vista.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100);
}

function formatearDocumento(doc) {
  if (!doc) return "-";
  const limpio = String(doc).replace(/\D/g, "");
  if (limpio.length <= 6) return limpio;
  return limpio.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function volverAlInicio() {
  const vista = document.getElementById("vistaConfirmacion");
  const formCard = document.getElementById("formCard");
  const formulario = document.getElementById("formulario");
  const mensajeBusqueda = document.getElementById("mensajeBusqueda");
  const docInput = document.getElementById("documento");
  const nombre = document.getElementById("nombre");
  const apellido = document.getElementById("apellido");
  
  if (vista) vista.classList.add("hidden");
  if (formCard) formCard.classList.remove("hidden");
  if (docInput) docInput.value = "";
  if (nombre) nombre.value = "";
  if (apellido) apellido.value = "";
  if (formulario) formulario.classList.add("hidden");
  if (mensajeBusqueda) {
    mensajeBusqueda.innerHTML = "";
    mensajeBusqueda.className = "";
  }
  
  filaActual = null;
  datosGimnastaActual = null;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function mostrarPago(estado) {
  const elemento = document.getElementById("estadoPago");
  if (!elemento) return;
  
  if (estado === "PAGADA" || estado === "PAGADO") {
    elemento.classList.add("pagado");
    elemento.innerHTML = "🟢 PAGO ACREDITADO";
  } else {
    elemento.classList.remove("pagado");
    elemento.innerHTML = "🟡 PAGO PENDIENTE";
  }
}

function pagar() {
  if (!datosGimnastaActual) {
    mostrarToast("error", "Error", "No hay datos de la gimnasta para procesar el pago.");
    return;
  }

  if (procesando) {
    mostrarToast("info", "Procesando", "Ya se está procesando su solicitud.");
    return;
  }

  const { documento, nombreCompleto, categoria } = datosGimnastaActual;

  mostrarProcesando(true);

  llamarAPI("obtenerDatos", {})
    .then(config => {
      const monto = config.monto_inscripcion || 5000;
      
      return llamarAPI("crearPreferenciaPago", {
        datos: {
          documento,
          nombreCompleto,
          categoria: categoria || "Sin categoría",
          monto: monto,
          email: ""
        }
      });
    })
    .then(resultado => {
      if (resultado.ok && resultado.initPoint) {
        mostrarToast("success", "Redirigiendo...", "Serás redirigido a Mercado Pago para completar el pago.");
        
        setTimeout(() => {
          window.location.href = resultado.initPoint;
        }, 1500);
      } else {
        throw new Error(resultado.error || "No se pudo crear el pago");
      }
    })
    .catch(error => {
      mostrarToast("error", "Error al pagar", error.message);
    })
    .finally(() => {
      mostrarProcesando(false);
    });
}

function manejarRetornoMP() {
  const params = new URLSearchParams(window.location.search);
  const pago = params.get("pago");
  const ref = params.get("ref");

  if (pago && ref) {
    if (pago === "success") {
      mostrarToast("success", "¡Pago exitoso!", "Tu pago fue acreditado correctamente.");
    } else if (pago === "pending") {
      mostrarToast("warning", "Pago pendiente", "Tu pago está en proceso de acreditación.");
    } else if (pago === "failure") {
      mostrarToast("error", "Pago rechazado", "El pago no pudo ser procesado. Intenta nuevamente.");
    }

    window.history.replaceState({}, document.title, window.location.pathname);

    if (ref) {
      setTimeout(() => {
        document.getElementById("documento").value = ref;
        buscar();
      }, 2000);
    }
  }
}

function limpiarFormulario() {
  const nombre = document.getElementById("nombre");
  const apellido = document.getElementById("apellido");
  const fecha = document.getElementById("fechaNacimiento");
  const consentimiento = document.getElementById("consentimiento");
  const datosGimnasta = document.getElementById("datosGimnasta");
  const tarjeta = document.getElementById("tarjetaEstadoPago");
  
  if (nombre) nombre.value = "";
  if (apellido) apellido.value = "";
  if (fecha) fecha.value = "";
  if (consentimiento) consentimiento.checked = false;
  
  document.querySelectorAll('input[name="puedeAsistir"]').forEach(r => r.checked = false);
  
  if (datosGimnasta) datosGimnasta.classList.add("hidden");
  if (tarjeta) tarjeta.classList.add("hidden");
  
  actualizarCategoriaVisual("");
}

function mostrarMensaje(texto, tipo) {
  const elemento = document.getElementById("mensajeBusqueda");
  if (elemento) {
    elemento.className = "message " + tipo;
    elemento.innerHTML = texto;
  }
}