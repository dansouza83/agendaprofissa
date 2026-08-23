/**
 * Runs the Vinext server on Netlify Functions. Static files continue to be
 * served from the CDN because `preferStatic` is enabled below.
 */
import vinextWorker from "../../dist/server/index.js";

export default async function app(request) {
  try {
    const response = await vinextWorker.fetch(request);

    // Vinext can return streamed responses. Buffer them before handing them to
    // a Netlify Function so JSON API responses complete reliably in browsers.
    const body = await response.arrayBuffer();
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    console.error("Agenda Profissa request error", error);
    return new Response("Não foi possível concluir esta solicitação.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

export const config = {
  path: "/*",
  preferStatic: true,
};
