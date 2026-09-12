// ===== Sincronización entre móvil y ordenador =====
// Guarda los datos CIFRADOS con tu contraseña dentro de tu repo de GitHub
// (archivo datos.json). Al abrir la web en cualquier dispositivo, se baja
// la versión más nueva; al hacer cambios, se sube la tuya.

const DUEÑO = 'arandabarbadev';
const REPO = 'mi-horario';
const RAMA = 'main';
const ARCHIVO = 'datos.json';
const CLAVE_AJUSTES = 'miHorarioAjustes';
const URL_API = `https://api.github.com/repos/${DUEÑO}/${REPO}/contents/${ARCHIVO}`;
const URL_CRUDA = `https://raw.githubusercontent.com/${DUEÑO}/${REPO}/${RAMA}/${ARCHIVO}`;

// ---------- Ajustes (token y contraseña de cifrado) ----------

function leerAjustes() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_AJUSTES)) || {};
  } catch {
    return {};
  }
}

function escribirAjustes(ajustes) {
  localStorage.setItem(CLAVE_AJUSTES, JSON.stringify(ajustes));
}

// ---------- Cifrado con contraseña (AES-GCM, estándar de la web) ----------

function aBase64(buffer) {
  let binario = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i]);
  return btoa(binario);
}

function desdeBase64(texto) {
  const binario = atob(texto);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

async function claveDesdeContraseña(contraseña, sal) {
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(contraseña), 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: sal, iterations: 210000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function cifrar(objeto, contraseña) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const clave = await claveDesdeContraseña(contraseña, sal);
  const cifrado = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, clave, new TextEncoder().encode(JSON.stringify(objeto)),
  );
  return { sal: aBase64(sal), iv: aBase64(iv), cifrado: aBase64(cifrado) };
}

async function descifrar(paquete, contraseña) {
  const clave = await claveDesdeContraseña(contraseña, desdeBase64(paquete.sal));
  const texto = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: desdeBase64(paquete.iv) }, clave, desdeBase64(paquete.cifrado),
  );
  return JSON.parse(new TextDecoder().decode(texto));
}

// ---------- Hablar con GitHub ----------

// btoa no entiende acentos; este truco convierte primero el texto a bytes UTF-8
function textoABase64Github(texto) {
  return btoa(unescape(encodeURIComponent(texto)));
}

async function subirADatosJson(textoPlano) {
  const { token } = leerAjustes();
  const cabeceras = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
  };

  // GitHub pide el "sha" del archivo actual para dejarlo sobrescribir
  let sha = null;
  const actual = await fetch(URL_API, { headers: cabeceras });
  if (actual.ok) sha = (await actual.json()).sha;
  else if (actual.status !== 404) throw new Error('GitHub respondió ' + actual.status);

  const respuesta = await fetch(URL_API, {
    method: 'PUT',
    headers: { ...cabeceras, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Actualizar datos de Mi horario',
      content: textoABase64Github(textoPlano),
      ...(sha ? { sha } : {}),
    }),
  });
  if (!respuesta.ok) throw new Error('GitHub respondió ' + respuesta.status);
}

async function bajarDatosJson() {
  // El ?t= evita que la copia en caché de internet nos dé datos viejos
  const respuesta = await fetch(`${URL_CRUDA}?t=${Date.now()}`);
  if (respuesta.status === 404) return null; // todavía no hay datos en GitHub
  if (!respuesta.ok) throw new Error('GitHub respondió ' + respuesta.status);
  return respuesta.json();
}

// ---------- La sincronización en sí ----------

let temporizador = null;
let ocupado = false;

// app.js llama a esto cada vez que cambian los datos:
// espera 15 segundos por si haces más cambios y entonces sube
function programarSubida() {
  clearTimeout(temporizador);
  temporizador = setTimeout(subirCambios, 15000);
}

async function subirCambios() {
  const { token, contraseña } = leerAjustes();
  if (!token || !contraseña || ocupado) return;
  ocupado = true;
  try {
    const paquete = await cifrar({ horario: datos.horario, tareas: datos.tareas }, contraseña);
    await subirADatosJson(JSON.stringify({ modificado: datos.modificado, ...paquete }));
    estado('✅ Sincronizado a las ' + new Date().toLocaleTimeString('es-ES'));
  } catch (error) {
    estado('⚠️ No se pudo sincronizar: ' + error.message);
  } finally {
    ocupado = false;
  }
}

// Al abrir la web: si GitHub tiene algo más nuevo, bajarlo y aplicarlo
async function sincronizarAlIniciar() {
  const { contraseña } = leerAjustes();
  try {
    const remoto = await bajarDatosJson();
    if (!remoto || remoto.modificado <= datos.modificado) return;
    if (!contraseña) {
      estado('ℹ️ Hay datos guardados en GitHub: pon tu contraseña en ⚙️ para bajarlos');
      return;
    }
    const nuevo = await descifrar(remoto, contraseña);
    datos.horario = nuevo.horario;
    datos.tareas = nuevo.tareas;
    datos.modificado = remoto.modificado;
    localStorage.setItem(CLAVE, JSON.stringify(datos));
    dibujar();
    estado('✅ Datos actualizados desde GitHub');
  } catch (error) {
    if (error.name === 'OperationError') {
      estado('⚠️ La contraseña no coincide con los datos guardados en GitHub');
    } else {
      estado('⚠️ Error al sincronizar: ' + error.message);
    }
  }
}

// Botón manual: primero bajar lo nuevo y luego subir lo nuestro
async function sincronizarAhora() {
  if (ocupado) return;
  ocupado = true;
  try {
    await sincronizarAlIniciar();
  } finally {
    ocupado = false;
  }
  await subirCambios();
}

// ---------- Panel de ajustes ----------

function estado(texto) {
  const caja = document.getElementById('estado-sync');
  if (caja) caja.textContent = texto;
}

document.getElementById('boton-ajustes').addEventListener('click', () => {
  const panel = document.getElementById('ajustes');
  panel.classList.toggle('oculto');
  if (!panel.classList.contains('oculto')) {
    const { token, contraseña } = leerAjustes();
    document.getElementById('token').value = token || '';
    document.getElementById('contrasena').value = contraseña || '';
  }
});

document.getElementById('form-ajustes').addEventListener('submit', evento => {
  evento.preventDefault();
  escribirAjustes({
    token: document.getElementById('token').value.trim(),
    contraseña: document.getElementById('contrasena').value,
  });
  estado('Ajustes guardados. Sincronizando…');
  sincronizarAhora();
});

// Al arrancar la web, mirar si GitHub tiene algo más nuevo
sincronizarAlIniciar();
