<div align="center">

# 🍎 El corte perfecto

### Tres manzanas. Una elección. Un corte.

**¿Cuánto te acercarás a dos mitades del mismo peso?**

[![Jugar](https://img.shields.io/badge/▶_JUGAR_AHORA-B54434?style=for-the-badge&logoColor=white)](https://goyoaga.github.io/corte-perfecto/)
[![Ko-fi](https://img.shields.io/badge/☕_INVÍTAME_UN_CAFÉ-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/arielgoyoaga)

![Three.js](https://img.shields.io/badge/Three.js-3D-101820?style=for-the-badge&logo=threedotjs&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES_Modules-F7DF1E?style=for-the-badge&logo=javascript&logoColor=222)
![Vite](https://img.shields.io/badge/Vite-Build-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-Hosting-222222?style=for-the-badge&logo=github&logoColor=white)

`🎮 Juego gratuito` · `📱 Móvil y escritorio` · `🪶 Sin cuentas ni servidor`

</div>

---

## ✨ Una pequeña obsesión por el equilibrio

Elige una de tres manzanas generadas con formas irregulares. Verás su **peso total antes de cortar**. Dibuja una línea con el ratón o el dedo, confirma un único corte y descubre cuánto pesa cada mitad. El resultado se mide en gramos y en porcentaje del peso original.

<div align="center">

**🍎 ELIGE → ✏️ TRAZA → 🔪 CORTA → ⚖️ COMPARA**

</div>

| Detalle | Cómo funciona |
| :--- | :--- |
| 🍏 Frutas | Tres manzanas diferentes en cada partida. |
| 📐 Corte | Un plano vertical definido por la línea que dibujas. Puedes reajustarla antes de confirmar. |
| ⚖️ Peso | El peso total depende del volumen de cada manzana y de una pequeña variación de densidad. Las mitades se calculan muestreando su forma 3D. |
| 🏆 Récord | Mejor diferencia porcentual guardada solo en tu navegador, cuando está disponible. |
| 🔊 Sonido | Desactivado inicialmente; puedes activarlo desde la cabecera. |

> [!NOTE]
> La medición representa el volumen digital de la manzana, no un modelo físico o científico de densidad variable. Tallo y hoja son decorativos.

## 📊 Visitas y partidas

El juego usa GoatCounter para registrar las visitas y el evento `corte-realizado` al pulsar **Hacer el corte**. Las estadísticas se consultan en el panel de GoatCounter del sitio `corteperfecto.goatcounter.com`; GitHub Insights mide el repositorio, no las visitas al juego de GitHub Pages. Si el navegador bloquea el script de analítica, el juego sigue funcionando.

## 🚀 Jugar

Abre **[goyoaga.github.io/corte-perfecto](https://goyoaga.github.io/corte-perfecto/)**. Si estás en móvil, desliza el dedo sobre la manzana para marcar el corte. Si estás en escritorio, haz lo mismo con el ratón.

Si te divertiste y te apetece apoyar pequeños juegos gratuitos como este, puedes **[invitarme un café en Ko-fi ☕](https://ko-fi.com/arielgoyoaga)**. Es completamente opcional.

## 🧰 Ejecutarlo en local

Necesitas Node.js 22 o superior.

```bash
git clone https://github.com/goyoaga/corte-perfecto.git
cd corte-perfecto
npm ci
npm run dev
```

Abre la URL que muestra Vite. Para verificar la versión de producción:

```bash
npm run build
npm run preview
```

## 📦 Publicación y uso real de Vite

**Sí, Vite se usa realmente:** `npm run dev` inicia su servidor de desarrollo; `npm run build` ejecuta `vite build`, que agrupa JavaScript, Three.js y CSS en la carpeta `dist/`. El flujo de `.github/workflows/deploy.yml` ejecuta `npm ci` y `npm run build` al enviar cambios a `main`, y publica **ese resultado compilado** en GitHub Pages. `vite.config.js` configura la ruta base `/corte-perfecto/`. Vite no se ejecuta como servidor permanente en producción: GitHub Pages entrega los archivos estáticos que generó.

## 🎨 Diseño y créditos

La estética toma como punto de partida la atmósfera de un experimento 3D editorial: fondo cálido, fruta brillante e interfaz ligera. Las manzanas y las caras interiores se generan en código; no se distribuyen imágenes ni modelos ajenos. Las fuentes **DM Sans** y **Playfair Display** se cargan desde Google Fonts; si no están disponibles, se usan fuentes del sistema. Las etiquetas del README se cargan desde Shields.io.

---

<div align="center"><sub>Hecho para jugar un minuto. O diez. 🍎</sub></div>
