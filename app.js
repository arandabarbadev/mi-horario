// ===== Mi horario =====
// De lunes a viernes: clases + cosas que hacer por la tarde.
// Sábado y domingo: tareas pendientes.
// Todo se guarda en el navegador (localStorage), sin cuentas ni servidores.

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const CORTOS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const NOMBRES = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves',
  viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
};
const CLAVE = 'miHorarioV1';
const esFinde = dia => dia === 'sabado' || dia === 'domingo';

// Las dos listas de cada día de entre semana
const TIPOS = [
  { tipo: 'clases', vacio: 'Sin clases todavía. Añade la primera abajo 👇' },
  { tipo: 'tarde', vacio: 'Nada por la tarde todavía. ¿Deberes, entrenamiento…? 🏁' },
];

// ---------- Datos ----------

function datosVacios() {
  const dia = { clases: [], tarde: [] };
  return { horario: Object.fromEntries(DIAS.map(d => [d, dia])), tareas: [] };
}

function cargar() {
  const datos = datosVacios();
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE));
    if (guardado) {
      DIAS.forEach(d => {
        const valor = guardado.horario?.[d];
        if (Array.isArray(valor)) {
          // Versión antigua: el día era solo la lista de clases
          datos.horario[d] = { clases: valor, tarde: [] };
        } else if (valor && Array.isArray(valor.clases)) {
          datos.horario[d] = {
            clases: valor.clases,
            tarde: Array.isArray(valor.tarde) ? valor.tarde : [],
          };
        }
      });
      if (Array.isArray(guardado.tareas)) datos.tareas = guardado.tareas;
    }
  } catch {
    // Si los datos guardados están rotos, se empieza de cero
  }
  return datos;
}

const datos = cargar();
const guardar = () => localStorage.setItem(CLAVE, JSON.stringify(datos));
const idNuevo = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------- Ayudas para crear elementos ----------

function elemento(tag, clase, texto) {
  const el = document.createElement(tag);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function botonIcono(caracter, titulo, alPulsar, extra) {
  const boton = elemento('button', 'icono' + (extra ? ' ' + extra : ''), caracter);
  boton.type = 'button';
  boton.title = titulo;
  boton.setAttribute('aria-label', titulo);
  boton.addEventListener('click', alPulsar);
  return boton;
}

// ---------- Dibujar la página ----------

// La web se abre en el día de hoy (0 = domingo en getDay, por eso el +6)
let diaActual = DIAS[(new Date().getDay() + 6) % 7];

function dibujar() {
  dibujarFecha();
  dibujarDias();
  const finde = esFinde(diaActual);
  document.getElementById('seccion-horario').classList.toggle('oculto', finde);
  document.getElementById('seccion-tareas').classList.toggle('oculto', !finde);
  document.getElementById('titulo-dia').textContent = NOMBRES[diaActual];
  if (finde) dibujarTareas(); else dibujarHorario();
}

function dibujarFecha() {
  const hoy = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  document.getElementById('fecha-hoy').textContent = 'Hoy es ' + hoy;
}

function dibujarDias() {
  const nav = document.getElementById('dias');
  nav.replaceChildren();
  DIAS.forEach((dia, i) => {
    const boton = elemento('button', null, CORTOS[i]);
    boton.type = 'button';
    if (dia === diaActual) boton.classList.add('activo');
    boton.addEventListener('click', () => { diaActual = dia; dibujar(); });
    nav.append(boton);
  });
}

// ---------- Clases y tarde (lunes a viernes) ----------

function dibujarHorario() {
  TIPOS.forEach(t => dibujarLista(t.tipo));
}

function dibujarLista(tipo) {
  const lista = document.getElementById('lista-' + tipo);
  lista.replaceChildren();
  const definicion = TIPOS.find(t => t.tipo === tipo);
  const filas = datos.horario[diaActual][tipo].slice().sort((a, b) => a.hora.localeCompare(b.hora));
  if (filas.length === 0) {
    lista.append(elemento('li', 'vacio', definicion.vacio));
    return;
  }
  filas.forEach(f => lista.append(filaHorario(f, tipo)));
}

function filaHorario(f, tipo) {
  const li = elemento('li', 'fila');
  li.dataset.id = f.id;
  li.append(elemento('span', 'hora', f.hora));
  li.append(elemento('span', 'texto', f.texto));
  const acciones = elemento('div', 'acciones');
  acciones.append(botonIcono('✎', 'Editar', () => editarHorario(f.id, tipo)));
  acciones.append(botonIcono('✕', 'Borrar', () => borrarHorario(f.id, tipo), 'peligro'));
  li.append(acciones);
  return li;
}

function borrarHorario(id, tipo) {
  const f = datos.horario[diaActual][tipo].find(x => x.id === id);
  if (confirm(`¿Borrar "${f.texto}" del ${NOMBRES[diaActual].toLowerCase()}?`)) {
    datos.horario[diaActual][tipo] = datos.horario[diaActual][tipo].filter(x => x.id !== id);
    guardar();
    dibujarLista(tipo);
  }
}

function editarHorario(id, tipo) {
  const f = datos.horario[diaActual][tipo].find(x => x.id === id);
  const li = document.querySelector(`#lista-${tipo} .fila[data-id="${id}"]`);

  const form = elemento('form', 'form-editar');
  const hora = document.createElement('input');
  hora.type = 'time';
  hora.value = f.hora;
  hora.required = true;

  const texto = document.createElement('input');
  texto.type = 'text';
  texto.value = f.texto;
  texto.required = true;
  texto.maxLength = 60;

  form.append(
    hora,
    texto,
    botonIcono('✓', 'Guardar cambios', () => form.requestSubmit()),
    botonIcono('✕', 'Cancelar', () => dibujarLista(tipo), 'peligro'),
  );

  form.addEventListener('submit', evento => {
    evento.preventDefault();
    f.hora = hora.value;
    f.texto = texto.value.trim();
    guardar();
    dibujarLista(tipo);
  });

  li.replaceChildren(form);
  texto.focus();
}

// ---------- Tareas pendientes (sábado y domingo) ----------

function dibujarTareas() {
  const lista = document.getElementById('lista-tareas');
  lista.replaceChildren();

  if (datos.tareas.length === 0) {
    lista.append(elemento('li', 'vacio', 'Sin tareas pendientes 🎉'));
  }

  datos.tareas.forEach(t => {
    const li = elemento('li', 'tarea');
    li.dataset.id = t.id;

    const caja = document.createElement('input');
    caja.type = 'checkbox';
    caja.checked = t.hecha;
    caja.addEventListener('change', () => {
      t.hecha = caja.checked;
      guardar();
      dibujarTareas();
    });

    const acciones = elemento('div', 'acciones');
    acciones.append(botonIcono('✕', 'Borrar tarea', () => borrarTarea(t.id), 'peligro'));

    li.append(caja, elemento('span', 'texto' + (t.hecha ? ' hecha' : ''), t.texto), acciones);
    lista.append(li);
  });

  const pendientes = datos.tareas.filter(t => !t.hecha).length;
  document.getElementById('titulo-tareas').textContent =
    'Tareas pendientes' + (pendientes > 0 ? ` (${pendientes})` : '');

  document.getElementById('quitar-hechas').classList.toggle(
    'oculto', !datos.tareas.some(t => t.hecha),
  );
}

function borrarTarea(id) {
  const t = datos.tareas.find(x => x.id === id);
  if (confirm(`¿Borrar la tarea "${t.texto}"?`)) {
    datos.tareas = datos.tareas.filter(x => x.id !== id);
    guardar();
    dibujarTareas();
  }
}

// ---------- Formularios para añadir ----------

TIPOS.forEach(t => {
  document.getElementById('form-' + t.tipo).addEventListener('submit', evento => {
    evento.preventDefault();
    const hora = document.getElementById('hora-' + t.tipo);
    const texto = document.getElementById('texto-' + t.tipo);
    datos.horario[diaActual][t.tipo].push({
      id: idNuevo(), hora: hora.value, texto: texto.value.trim(),
    });
    guardar();
    evento.target.reset();
    dibujarLista(t.tipo);
    texto.focus();
  });
});

document.getElementById('form-tareas').addEventListener('submit', evento => {
  evento.preventDefault();
  const campo = document.getElementById('tarea-nueva');
  datos.tareas.push({ id: idNuevo(), texto: campo.value.trim(), hecha: false });
  guardar();
  evento.target.reset();
  dibujarTareas();
  campo.focus();
});

document.getElementById('quitar-hechas').addEventListener('click', () => {
  datos.tareas = datos.tareas.filter(t => !t.hecha);
  guardar();
  dibujarTareas();
});

// Registrar el service worker: así la web se instala como app
// y funciona incluso sin conexión (en el PC con el archivo suelto no hace falta)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js');
}

// ¡Empieza la carrera!
dibujar();
