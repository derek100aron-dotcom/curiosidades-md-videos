// Publicar un Reel en Instagram (API con inicio de sesión de Instagram), en dos pasos:
//   node publicar.mjs desde-url <url_publica_mp4> "descripción" → Instagram descarga el MP4 de esa URL y lo procesa
//   node publicar.mjs subir out/video.mp4 "descripción"   → subida directa (solo API con inicio de sesión de Facebook)
//   node publicar.mjs publicar <id_contenedor>             → lo publica (solo con la confirmación del usuario)
// El token NO está aquí: el proxy del entorno lo añade (graph.instagram.com con "Bearer",
// rupload.facebook.com con "OAuth").
import { readFile, stat } from "node:fs/promises";

const API = "https://graph.instagram.com/v21.0";
const [, , accion, ...args] = process.argv;

const pedir = async (url, opciones = {}) => {
  const r = await fetch(url, opciones);
  const texto = await r.text();
  let json;
  try {
    json = JSON.parse(texto);
  } catch {
    json = { crudo: texto };
  }
  if (!r.ok || json.error) throw new Error(`${r.status} ${url.split("?")[0]} → ${JSON.stringify(json.error ?? json)}`);
  return json;
};

// Espera a que Instagram termine de procesar el contenedor
const esperar = async (id) => {
  for (let i = 0; i < 60; i++) {
    const { status_code, status } = await pedir(`${API}/${id}?fields=status_code,status`);
    console.log("Estado:", status_code, status ?? "");
    if (status_code === "FINISHED") {
      console.log(`LISTO_PARA_PUBLICAR ${id}`);
      return;
    }
    if (status_code === "ERROR" || status_code === "EXPIRED") throw new Error(`Instagram no pudo procesar el video: ${status}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("Instagram tardó demasiado en procesar el video");
};

// La portada va en el primer fotograma del MP4 (thumb_offset: 0)
const desdeUrl = async (url, descripcion = "") => {
  const cont = await pedir(`${API}/me/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "REELS", video_url: url, caption: descripcion, share_to_feed: true, thumb_offset: 0 }),
  });
  console.log("Contenedor:", cont.id);
  await esperar(cont.id);
};

const subir = async (archivo, descripcion = "") => {
  const { size } = await stat(archivo);
  const cont = await pedir(`${API}/me/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "REELS", upload_type: "resumable", caption: descripcion, share_to_feed: true, thumb_offset: 0 }),
  });
  console.log("Contenedor:", cont.id);
  const uri = cont.uri ?? `https://rupload.facebook.com/ig-api-upload/v21.0/${cont.id}`;
  const subida = await pedir(uri, {
    method: "POST",
    headers: { offset: "0", file_size: String(size), "Content-Type": "application/octet-stream" },
    body: await readFile(archivo),
  });
  console.log("Subida:", JSON.stringify(subida));
  for (let i = 0; i < 60; i++) {
    const { status_code, status } = await pedir(`${API}/${cont.id}?fields=status_code,status`);
    console.log("Estado:", status_code, status ?? "");
    if (status_code === "FINISHED") {
      console.log(`LISTO_PARA_PUBLICAR ${cont.id}`);
      return;
    }
    if (status_code === "ERROR" || status_code === "EXPIRED") throw new Error(`Instagram no pudo procesar el video: ${status}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("Instagram tardó demasiado en procesar el video");
};

const publicar = async (id) => {
  const r = await pedir(`${API}/me/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: id }),
  });
  const { permalink } = await pedir(`${API}/${r.id}?fields=permalink`);
  console.log("Publicado:", r.id, permalink ?? "");
};

if (accion === "desde-url") await desdeUrl(args[0], args[1]);
else if (accion === "subir") await subir(args[0], args[1]);
else if (accion === "publicar") await publicar(args[0]);
else console.log('Uso: node publicar.mjs desde-url <url> "<descripción>" | subir <video.mp4> "<descripción>" | publicar <id_contenedor>');
