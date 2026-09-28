<div align="center">

# 🍎 El corte perfecto

### Tres manzanas. Una elección. Un corte.

**¿Cuánto te acercarás a dos mitades del mismo peso?**

[![Jugar](https://img.shields.io/badge/▶_JUGAR_AHORA-B54434?style=for-the-badge&logoColor=white)](https://goyoaga.github.io/corte-perfecto/)

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
| ⚖️ Peso | El volumen irregular de la misma forma 3D se muestrea de manera determinista; densidad uniforme. |
| 🏆 Récord | Mejor diferencia porcentual guardada solo en tu navegador, cuando está disponible. |
| 🔊 Sonido | Desactivado inicialmente; puedes activarlo desde la cabecera. |

> [!NOTE]
> La medición representa el volumen digital de la manzana, no un modelo físico o científico de densidad variable. Tallo y hoja son decorativos.

## 🚀 Jugar

Abre **[goyoaga.github.io/corte-perfecto](https://goyoaga.github.io/corte-perfecto/)**. Si estás en móvil, desliza el dedo sobre la manzana para marcar el corte. Si estás en escritorio, haz lo mismo con el ratón.

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

## 📦 Publicación

El flujo de `.github/workflows/deploy.yml` compila el proyecto al enviar cambios a `main` y despliega `dist/` en GitHub Pages. En el repositorio, selecciona **Settings → Pages → Build and deployment → Source: GitHub Actions**. La ruta base ya está configurada para `/corte-perfecto/`.

## 🎨 Diseño y créditos

La estética toma como punto de partida la atmósfera de un experimento 3D editorial: fondo cálido, fruta brillante e interfaz ligera. Las manzanas y las caras interiores se generan en código; no se distribuyen imágenes ni modelos ajenos. Las fuentes **DM Sans** y **Playfair Display** se cargan desde Google Fonts; si no están disponibles, se usan fuentes del sistema. Las etiquetas del README se cargan desde Shields.io.

---

<div align="center"><sub>Hecho para jugar un minuto. O diez. 🍎</sub></div>
