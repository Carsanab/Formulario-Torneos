// ⚠️ REEMPLAZÁ ESTAS 6 URLS CON TUS DATOS REALES
const CSV_GIMNASTAS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSja6kRRbx1ScCQ47mEPEZQeiBp2rM2uJfW5KJ_GxHjHen1SZ68FDUNrZLvRgaI4hKG3-VdSe9CDQF7/pub?gid=0&single=true&output=csv";
const CSV_CATEGORIAS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSja6kRRbx1ScCQ47mEPEZQeiBp2rM2uJfW5KJ_GxHjHen1SZ68FDUNrZLvRgaI4hKG3-VdSe9CDQF7/pub?gid=879522760&single=true&output=csv";
const CSV_DATOS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSja6kRRbx1ScCQ47mEPEZQeiBp2rM2uJfW5KJ_GxHjHen1SZ68FDUNrZLvRgaI4hKG3-VdSe9CDQF7/pub?gid=1470762749&single=true&output=csv";
const CSV_BASE_GIMNASTAS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSja6kRRbx1ScCQ47mEPEZQeiBp2rM2uJfW5KJ_GxHjHen1SZ68FDUNrZLvRgaI4hKG3-VdSe9CDQF7/pub?gid=1735555037&single=true&output=csv";
const CSV_MONTOS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSja6kRRbx1ScCQ47mEPEZQeiBp2rM2uJfW5KJ_GxHjHen1SZ68FDUNrZLvRgaI4hKG3-VdSe9CDQF7/pub?gid=1653649540&single=true&output=csv";
const API_URL = "https://script.google.com/macros/s/AKfycbz0GR3bcvVC-pUzmOjw2NUN71H3S-91ClSwfWfePkAKaujnyo3biYOo9I7oWFAVIGWO/exec";

// Cache local de todas las tablas
let cache = {
  gimnastas: [],         // Inscripciones actuales
  categorias: [],        // Edad → Categoría
  datos: {},             // Configuración del torneo
  baseGimnastas: [],     // Base maestra
  montos: []             // Nivel + Categoría → Monto
};

let filaActual = null;
let inscripcionesAbiertas = true;
let procesando = false;
let datosGimnastaActual = null;

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener("DOMContentLoaded", async function() {
  crearContenedorToast();
  crearOverlayProcesando();
  
  // Precargar TODAS las tablas en paralelo
  await Promise.all([
    cargarCSV("gimnastas", CSV_GIMNASTAS),
    cargarCSV("categorias", CSV_CATEGORIAS),
    cargarCSV("datos", CSV_DATOS, true),
    cargarCSV("baseGimnastas", CSV_BASE_GIMNASTAS),
    cargarCSV("montos", CSV_MONTOS)
  ]);

  // Procesar configuración
  procesarConfiguracion();
  
  manejarRetornoMP();
});

// ==========================================
// CARGA DE CSV (ULTRA RÁPIDO)
// ==========================================
async function cargarCSV(key, url, esConfig = false) {
  try {
    const response = await fetch(url);
    const csvText = await response.text();
    
    if (esConfig) {
      cache.datos = parseCSVConfig(csvText);
    } else {
      cache[key] = parseCSV(csvText);
    }
    console.log(`✅ ${key} cargado: ${esConfig ? 'config' : cache[key].length + ' registros'}`);
  } catch (error) {
    console.error(`❌ Error al cargar ${key}:`, error);
    mostrarToast("error", "Error de carga", `No se pudo cargar ${key}. Recargue la página.`);
  }
}

function parseCSV(text) {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  if (lines.length < 2) return [];
  
  // Normalizar headers: lowercase, sin espacios, sin guiones
  const headers = lines[0].split(',').map(h => 
    h.trim().replace(/^"|"$/g, '').toLowerCase().replace(/[\s_]+/g, '')
  );
  
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ? values[index].replace(/^"|"$/g, '').trim() : '';
    });
    data.push(row);
  }
  return data;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseCSVConfig(text) {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  if (lines.length < 2) return {};
  
  const headers = lines[0].split(',').map(h => 
    h.trim().replace(/^"|"$/g, '').toLowerCase().replace(/[\s_]+/g, '')
  );
  const values = parseCSVLine(lines[1]);
  
  const config = {};
  headers.forEach((header, index) => {
    config[header] = values[index] ? values[index].replace(/^"|"$/g, '').trim() : '';
  });
  return config;
}

// ==========================================
// PROCESAR CONFIGURACIÓN
// ==========================================
function procesarConfiguracion() {
  const config = cache.datos;
  
  setTexto("infoTorneo", config.titulotorneo || config.titulo_torneo || "-");
  setTexto("infoClub", config.club || "-");
  setTexto("infoFechaEvento", config.fechaevento || config.fecha_evento || "-");
  setTexto("infoTitulo3", config.titulo3 || "");
  setTexto("infoTitulo4", config.titulo4 || "");
  
  const fechaLimiteRaw = config.fechalimite || config.fecha_limite;
  setTexto("infoFechaLimite", formatearFechaParaMostrar(fechaLimiteRaw));
  
  const tituloTorneo = config.titulotorneo || config.titulo_torneo;
  if (tituloTorneo) document.title = "Confirmación de Asistencia - " + tituloTorneo;
  
  // Verificar fecha límite
  if (fechaLimiteRaw) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const limite = new Date(fechaLimiteRaw);
    limite.setHours(23, 59, 59, 999);
    inscripcionesAbiertas = hoy <= limite;
    
    if (!inscripcionesAbiertas) {
      bloquearFormulario(fechaLimiteRaw);
    }
  }
}

// ==========================================
// BÚSQUEDA DE GIMNASTA
// ==========================================
async function buscar() {
  if (procesando) return;
  if (!inscripcionesAbiertas) {
    mostrarToast("warning", "Inscripciones cerradas", "El plazo ha vencido.");
    return;
  }

  const documentoInput = document.getElementById("documento").value.trim();
  if (!documentoInput || !/^\d+$/.test(documentoInput) || documentoInput.length < 7) {
    mostrarToast("error", "Documento inválido", "Ingrese al menos 7 dígitos numéricos.");
    return;
  }

  mostrarMensaje("Buscando...", "info");
  mostrarProcesando(true);

  try {
    // PASO 1: Buscar en Base de Gimnastas (base maestra)
    const baseGimnasta = cache.baseGimnastas.find(g => 
      String(g.documento || '').replace(/\D/g, '') === documentoInput
    );

    const formulario = document.getElementById("formulario");
    if (formulario) formulario.classList.remove("hidden");

    if (!baseGimnasta) {
      // NO EXISTE EN BASE MAESTRA → BLOQUEAR
      filaActual = null;
      mostrarMensaje("❌ Documento inexistente. Comuníquese con el coordinador.", "error");
      mostrarToast("error", "Documento no encontrado", "Este documento no está en la base. Comuníquese con el coordinador.", 6000);
      limpiarFormulario();
      return;
    }

    // PASO 2: Buscar en Gimnastas (inscripciones al torneo actual)
    const inscripcion = cache.gimnastas.find(g => 
      String(g.documento || '').replace(/\D/g, '') === documentoInput
    );

    filaActual = inscripcion ? (inscripcion.fila || 0) : null;

    // PASO 3: Calcular monto según nivel + categoría
    const nivel = (baseGimnasta.nivel || '').trim();
    const categoria = (baseGimnasta.categoria || '').trim();
    const monto = calcularMonto(nivel, categoria);

    if (!monto) {
      mostrarMensaje(`❌ No hay monto definido para Nivel ${nivel} - Categoría ${categoria}. Comuníquese con el coordinador.`, "error");
      mostrarToast("error", "Monto no definido", `No hay precio para ${nivel} / ${categoria}.`, 6000);
      return;
    }

    // PASO 4: Cargar datos en el formulario
    const datosMapeados = {
      documento: baseGimnasta.documento,
      nombres: baseGimnasta.nombres || baseGimnasta.nombre || '',
      fechaNacimiento: baseGimnasta.fechadenacimiento || baseGimnasta.fecha_de_nacimiento || baseGimnasta.fechanacimiento || '',
      categoria: categoria,
      nivel: nivel,
      monto: monto,
      puedeAsistir: inscripcion ? (inscripcion.puedeasistir || '') : '',
      consentimiento: inscripcion ? (inscripcion.consentimiento || '') : '',
      estadoPago: inscripcion ? (inscripcion.estadopago || 'PENDIENTE') : 'NUEVO',
      pagoId: inscripcion ? (inscripcion.pagoid || '') : '',
      fechaRegistro: inscripcion ? (inscripcion.fecharegistro || '') : '',
      fechaActualizacion: inscripcion ? (inscripcion.fechaactualizacion || '') : ''
    };

    cargarDatos(datosMapeados);

    setTimeout(() => {
      const tarjeta = document.getElementById("tarjetaEstadoPago");
      if (tarjeta) tarjeta.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);

  } catch (error) {
    console.error("Error en buscar:", error);
    mostrarMensaje("Error: " + error.message, "error");
    mostrarToast("error", "Error", error.message);
  } finally {
    mostrarProcesando(false);
  }
}

function calcularMonto(nivel, categoria) {
  const nivelNorm = nivel.trim().toLowerCase();
  const catNorm = categoria.trim().toLowerCase();
  
  const registro = cache.montos.find(m => 
    (m.nivel || '').trim().toLowerCase() === nivelNorm && 
    (m.categoria || '').trim().toLowerCase() === catNorm
  );
  
  if (!registro) return null;
  
  // Parsear monto (puede venir como "$25,000.00" o "25000")
  const montoStr = String(registro.monto || '0').replace(/[$,\s]/g, '').replace('.', ',');
  const monto = parseFloat(montoStr.replace(',', '.'));
  return isNaN(monto) ? null : monto;
}

// ==========================================
// CARGAR DATOS EN FORMULARIO
// ==========================================
function cargarDatos(datos) {
  document.getElementById("documento").value = datos.documento || "";
  document.getElementById("nombres").value = datos.nombres || "";
  document.getElementById("fechaNacimiento").value = formatearFechaParaMostrar(datos.fechaNacimiento) || datos.fechaNacimiento;
  document.getElementById("categoria").value = datos.categoria || "";
  document.getElementById("nivel").value = datos.nivel || "";
  document.getElementById("monto").value = formatearMonto(datos.monto);

  const radioSi = document.querySelector('input[name="puedeAsistir"][value="SI"]');
  const radioNo = document.querySelector('input[name="puedeAsistir"][value="NO"]');
  if (datos.puedeAsistir === "SI" && radioSi) radioSi.checked = true;
  else if (datos.puedeAsistir === "NO" && radioNo) radioNo.checked = true;
  else if (radioSi && radioNo) { radioSi.checked = false; radioNo.checked = false; }

  const consentimiento = document.getElementById("consentimiento");
  if (consentimiento) consentimiento.checked = datos.consentimiento === "SI";

  document.getElementById("datosGimnasta").classList.remove("hidden");

  // Guardar datos para pago
  datosGimnastaActual = {
    documento: datos.documento,
    nombres: datos.nombres,
    categoria: datos.categoria,
    nivel: datos.nivel,
    monto: datos.monto,
    estadoPago: datos.estadoPago
  };

  mostrarTarjetaEstadoPago(datos);
}

function formatearMonto(monto) {
  if (!monto) return "$0";
  return "$" + Number(monto).toLocaleString('es-AR');
}

function mostrarTarjetaEstadoPago(datos) {
  const tarjeta = document.getElementById("tarjetaEstadoPago");
  const badge = document.getElementById("estadoBadge");
  const estadoTexto = document.getElementById("estadoTexto");
  const estadoIcon = document.getElementById("estadoIcon");
  const estadoTitulo = document.getElementById("estadoTitulo");
  const estadoSubtitulo = document.getElementById("estadoSubtitulo");
  const accionPago = document.getElementById("accionPago");
  const accionPagado = document.getElementById("accionPagado");
  const infoExistente = document.getElementById("infoInscripcionExistente");
  const montoAPagar = document.getElementById("montoAPagar");

  tarjeta.classList.remove("hidden");
  badge.classList.remove("pendiente", "pagado");
  accionPago.classList.add("hidden");
  accionPagado.classList.add("hidden");
  infoExistente.classList.add("hidden");

  // Mostrar monto a pagar
  if (montoAPagar) montoAPagar.textContent = formatearMonto(datos.monto);

  const estado = datos.estadoPago;

  if (estado === "PAGADO" || estado === "PAGADA") {
    // PAGADO
    badge.classList.add("pagado");
    estadoTexto.textContent = "PAGO ACREDITADO";
    estadoIcon.textContent = "✅";
    estadoTitulo.textContent = "Inscripción completa";
    estadoSubtitulo.textContent = "Su pago fue acreditado correctamente";
    accionPagado.classList.remove("hidden");

    // Mostrar info de inscripción existente
    if (datos.pagoId || datos.fechaRegistro) {
      infoExistente.classList.remove("hidden");
      document.getElementById("infoPagoId").textContent = datos.pagoId || "-";
      document.getElementById("infoFechaRegistro").textContent = formatearFechaParaMostrar(datos.fechaRegistro) || "-";
      document.getElementById("infoFechaActualizacion").textContent = formatearFechaParaMostrar(datos.fechaActualizacion) || "-";
    }
  } else {
    // PENDIENTE o NUEVO
    badge.classList.add("pendiente");
    estadoTexto.textContent = "PAGO PENDIENTE";
    estadoIcon.textContent = "⏳";
    estadoTitulo.textContent = datos.estadoPago === "NUEVO" ? "Nueva inscripción" : "Inscripción registrada";
    estadoSubtitulo.textContent = datos.estadoPago === "NUEVO" ? "Complete los datos para inscribirse" : "Falta completar el pago";
    accionPago.classList.remove("hidden");

    // Mostrar info de inscripción existente
    if (datos.pagoId || datos.fechaRegistro) {
      infoExistente.classList.remove("hidden");
      document.getElementById("infoPagoId").textContent = datos.pagoId || "-";
      document.getElementById("infoFechaRegistro").textContent = formatearFechaParaMostrar(datos.fechaRegistro) || "-";
      document.getElementById("infoFechaActualizacion").textContent = formatearFechaParaMostrar(datos.fechaActualizacion) || "-";
    }
  }
}

// ==========================================
// GUARDAR INSCRIPCIÓN
// ==========================================
async function guardar() {
  if (procesando) { mostrarToast("info", "Procesando", "Espere un momento."); return; }
  if (!inscripcionesAbiertas) { mostrarToast("warning", "Inscripciones cerradas", "El plazo ha vencido."); return; }

  const radioSi = document.querySelector('input[name="puedeAsistir"][value="SI"]');
  const radioNo = document.querySelector('input[name="puedeAsistir"][value="NO"]');
  if (!radioSi || !radioNo || (!radioSi.checked && !radioNo.checked)) {
    mostrarToast("error", "Campo requerido", "Seleccione si puede asistir.");
    return;
  }

  const puedeAsistir = radioSi.checked ? "SI" : "NO";
  if (puedeAsistir !== "SI") {
    mostrarToast("warning", "Asistencia requerida", "Confirme que puede asistir.");
    return;
  }

  const consentimiento = document.getElementById("consentimiento").checked;
  if (!consentimiento) {
    mostrarToast("warning", "Consentimiento requerido", "Acepte las indicaciones.");
    return;
  }

  if (!datosGimnastaActual) {
    mostrarToast("error", "Error", "No hay datos de la gimnasta.");
    return;
  }

  const datos = {
    documento: datosGimnastaActual.documento,
    nombres: datosGimnastaActual.nombres,
    fechaNacimiento: normalizarFechaParaGuardar(document.getElementById("fechaNacimiento").value),
    categoria: datosGimnastaActual.categoria,
    nivel: datosGimnastaActual.nivel,
    puedeAsistir,
    consentimiento: true
  };

  mostrarProcesando(true);

  try {
    const resultado = await llamarAPI("guardar", { datos });
    
    if (resultado.actualizado) {
      mostrarToast("success", "Datos actualizados", "Correctamente.");
    } else {
      mostrarToast("success", "¡Inscripción registrada!", "Correctamente.");
    }

    // Actualizar estado local
    datosGimnastaActual.estadoPago = resultado.estadoPago || "PENDIENTE";

    mostrarVistaConfirmacion({
      nombres: datosGimnastaActual.nombres,
      documento: datosGimnastaActual.documento,
      categoria: datosGimnastaActual.categoria,
      nivel: datosGimnastaActual.nivel,
      monto: datosGimnastaActual.monto,
      estadoPago: resultado.estadoPago || "PENDIENTE"
    });
  } catch (error) {
    mostrarToast("error", "Error al guardar", error.message);
  } finally {
    mostrarProcesando(false);
  }
}

function normalizarFechaParaGuardar(fechaStr) {
  // Convertir "DD/MM/YYYY" a "YYYY-MM-DD"
  if (!fechaStr) return "";
  const partes = fechaStr.split("/");
  if (partes.length === 3) {
    return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
  }
  return fechaStr;
}

function mostrarVistaConfirmacion(datos) {
  const formCard = document.getElementById("formCard");
  const vista = document.getElementById("vistaConfirmacion");
  if (formCard) formCard.classList.add("hidden");
  if (vista) vista.classList.remove("hidden");

  document.getElementById("confNombres").textContent = datos.nombres || "-";
  document.getElementById("confDocumento").textContent = formatearDocumento(datos.documento);
  document.getElementById("confCategoria").textContent = datos.categoria || "-";
  document.getElementById("confNivel").textContent = datos.nivel || "-";
  document.getElementById("confMonto").textContent = formatearMonto(datos.monto);

  const badge = document.getElementById("confEstadoBadge");
  const icon = document.getElementById("confEstadoIcon");
  const accionPagar = document.getElementById("confAccionPagar");
  const accionPagado = document.getElementById("confAccionPagado");

  badge.classList.remove("pagado");
  accionPagar.classList.add("hidden");
  accionPagado.classList.add("hidden");

  if (datos.estadoPago === "PAGADO" || datos.estadoPago === "PAGADA") {
    badge.textContent = "PAGO ACREDITADO";
    badge.classList.add("pagado");
    icon.textContent = "✅";
    accionPagado.classList.remove("hidden");
  } else {
    badge.textContent = "PAGO PENDIENTE";
    icon.textContent = "⏳";
    accionPagar.classList.remove("hidden");
  }

  setTimeout(() => { if (vista) vista.scrollIntoView({ behavior: "smooth", block: "start" }); }, 100);
}

// ==========================================
// MERCADO PAGO
// ==========================================
function pagar() {
  if (!datosGimnastaActual) { mostrarToast("error", "Error", "No hay datos para pagar."); return; }
  if (procesando) { mostrarToast("info", "Procesando", "Espere un momento."); return; }

  const { documento, nombres, categoria, nivel, monto } = datosGimnastaActual;
  mostrarProcesando(true);

  llamarAPI("crearPreferenciaPago", {
    datos: { 
      documento, 
      nombres, 
      categoria, 
      nivel, 
      monto: Number(monto),
      email: "" 
    }
  })
  .then(resultado => {
    if (resultado.ok && resultado.initPoint) {
      mostrarToast("success", "Redirigiendo...", "Serás llevado a Mercado Pago.");
      setTimeout(() => { window.location.href = resultado.initPoint; }, 1500);
    } else {
      throw new Error(resultado.error || "No se pudo crear el pago");
    }
  })
  .catch(error => { mostrarToast("error", "Error al pagar", error.message); })
  .finally(() => { mostrarProcesando(false); });
}

function manejarRetornoMP() {
  const params = new URLSearchParams(window.location.search);
  const pago = params.get("pago");
  const ref = params.get("ref");
  if (pago && ref) {
    if (pago === "success") mostrarToast("success", "¡Pago exitoso!", "Acreditado correctamente.");
    else if (pago === "pending") mostrarToast("warning", "Pago pendiente", "En proceso de acreditación.");
    else if (pago === "failure") mostrarToast("error", "Pago rechazado", "Intente nuevamente.");
    window.history.replaceState({}, document.title, window.location.pathname);
    if (ref) {
      setTimeout(() => {
        document.getElementById("documento").value = ref;
        buscar();
      }, 2000);
    }
  }
}

// ==========================================
// UTILIDADES
// ==========================================
function llamarAPI(accion, payload = {}) {
  return fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ accion, ...payload })
  })
  .then(r => {
    if (!r.ok) throw new Error(`Error del servidor (${r.status})`);
    return r.json();
  });
}

function setTexto(id, texto) {
  const el = document.getElementById(id);
  if (el) el.textContent = texto || "";
}

function formatearFechaParaMostrar(fechaStr) {
  if (!fechaStr) return "";
  // Manejar formato "DD/MM/YYYY HH:mm"
  const partes = fechaStr.split(" ")[0].split("/");
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  // Manejar formato "YYYY-MM-DD"
  const partes2 = fechaStr.split("-");
  if (partes2.length === 3) return `${partes2[2]}/${partes2[1]}/${partes2[0]}`;
  return fechaStr;
}

function formatearDocumento(doc) {
  if (!doc) return "-";
  const limpio = String(doc).replace(/\D/g, "");
  if (limpio.length <= 6) return limpio;
  return limpio.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
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

function bloquearFormulario(fechaLimite) {
  const bloque = document.getElementById("bloqueInscripciones");
  const fechaEl = document.getElementById("fechaLimiteMostrada");
  const contenido = document.getElementById("contenidoPrincipal");
  if (bloque) bloque.classList.remove("hidden");
  if (fechaEl) fechaEl.textContent = formatearFechaParaMostrar(fechaLimite);
  if (contenido) contenido.classList.add("hidden");
  setTimeout(() => mostrarToast("warning", "Inscripciones cerradas", "El plazo ha vencido.", 6000), 500);
}

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
    overlay.innerHTML = `<div class="procesando-card"><div class="spinner"></div><div class="procesando-texto">Procesando...</div><div class="procesando-subtexto">Por favor, espere un momento</div></div>`;
    document.body.appendChild(overlay);
  }
}

function mostrarProcesando(mostrar) {
  const overlay = document.getElementById("overlayProcesando");
  if (overlay) {
    if (mostrar) {
      overlay.classList.add("activo");
      procesando = true;
      const btn = document.querySelector(".btn-guardar");
      if (btn) btn.disabled = true;
    } else {
      overlay.classList.remove("activo");
      procesando = false;
      const btn = document.querySelector(".btn-guardar");
      if (btn) btn.disabled = false;
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
  toast.innerHTML = `<div class="toast-icon">${iconos[tipo] || "ℹ️"}</div><div class="toast-contenido"><div class="toast-titulo">${titulo || titulosDefault[tipo]}</div><div class="toast-mensaje">${mensaje}</div></div><button class="toast-cerrar" onclick="cerrarToast(this.parentElement)">✕</button><div class="toast-barra"></div>`;
  container.appendChild(toast);
  setTimeout(() => cerrarToast(toast), duracion);
}

function cerrarToast(toast) {
  if (!toast || toast.classList.contains("saliendo")) return;
  toast.classList.add("saliendo");
  setTimeout(() => { if (toast.parentElement) toast.parentElement.removeChild(toast); }, 300);
}

function volverAlInicio() {
  const vista = document.getElementById("vistaConfirmacion");
  const formCard = document.getElementById("formCard");
  const formulario = document.getElementById("formulario");
  const mensajeBusqueda = document.getElementById("mensajeBusqueda");
  const docInput = document.getElementById("documento");
  
  if (vista) vista.classList.add("hidden");
  if (formCard) formCard.classList.remove("hidden");
  if (docInput) docInput.value = "";
  if (formulario) formulario.classList.add("hidden");
  if (mensajeBusqueda) { mensajeBusqueda.innerHTML = ""; mensajeBusqueda.className = ""; }
  
  filaActual = null;
  datosGimnastaActual = null;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function limpiarFormulario() {
  const nombres = document.getElementById("nombres");
  const fecha = document.getElementById("fechaNacimiento");
  const categoria = document.getElementById("categoria");
  const nivel = document.getElementById("nivel");
  const monto = document.getElementById("monto");
  const consentimiento = document.getElementById("consentimiento");
  const datosGimnasta = document.getElementById("datosGimnasta");
  const tarjeta = document.getElementById("tarjetaEstadoPago");
  
  if (nombres) nombres.value = "";
  if (fecha) fecha.value = "";
  if (categoria) categoria.value = "";
  if (nivel) nivel.value = "";
  if (monto) monto.value = "";
  if (consentimiento) consentimiento.checked = false;
  document.querySelectorAll('input[name="puedeAsistir"]').forEach(r => r.checked = false);
  if (datosGimnasta) datosGimnasta.classList.add("hidden");
  if (tarjeta) tarjeta.classList.add("hidden");
}

function mostrarMensaje(texto, tipo) {
  const el = document.getElementById("mensajeBusqueda");
  if (el) { el.className = "message " + tipo; el.innerHTML = texto; }
}