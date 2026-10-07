# Guía de iconos de Gridly

Esta guía define el estilo de los iconos de interfaz y cómo ampliar el catálogo existente.

## Especificaciones comunes

| Propiedad | Valor |
| --- | --- |
| Cuadrícula SVG | `viewBox="0 0 24 24"` |
| Tamaño habitual | 24 × 24 px |
| Grosor del trazo | 2 unidades |
| Extremos | `stroke-linecap="round"` |
| Uniones | `stroke-linejoin="round"` |
| Relleno | `fill="none"` |
| Color | `stroke="currentColor"` |
| Alineación | Centrada en el control, sin encoger con flexbox |

Usar dibujos sencillos, con una silueta reconocible a 24 px. Situar la mayor parte del dibujo entre las coordenadas 3 y 21, dejando espacio para el grosor del trazo. Ajustar ópticamente las formas estrechas o redondas para que tengan un peso visual comparable. Comprobar también los extremos de curvas y flechas: el trazo completo debe caber en la cuadrícula.

Priorizar coordenadas enteras, líneas limpias y pocos detalles interiores. Compartir geometría entre acciones relacionadas: deshacer/rehacer se reflejan; agrupar/desagrupar comparten sus piezas. Las formas constructivas deben distinguirse entre sí por su estructura, no por su color.

No usar caracteres Unicode, emojis, imágenes rasterizadas, colores fijos ni SVG duplicados dentro de las vistas para representar acciones. Los estados de selección, hover y deshabilitado se expresan mediante los estilos del control y el color heredado.

## Componentes y catálogo

- `src/icons.ts`: catálogo de trazados SVG, agrupados por nombre. Cada icono contiene una o varias cadenas `d`. El tipo `IconName` se deriva del catálogo.
- `src/AppIcon.vue`: componente común; aplica tamaño, trazo, accesibilidad y representación.
- `src/style.css`: alineación y adaptación a los controles existentes.

Ejemplo de uso:

```vue
<script setup lang="ts">
import AppIcon from './AppIcon.vue'
</script>

<template>
  <button aria-label="Duplicar selección" title="Duplicar selección">
    <AppIcon name="duplicate" />
  </button>
</template>
```

En controles con texto, conservar el texto y separar icono y etiqueta mediante `gap` (habitualmente 6–8 px). Un icono no sustituye el nombre accesible del botón. `AppIcon` es decorativo: utiliza `aria-hidden="true"`, `focusable="false"` y no intercepta eventos de puntero.

## Añadir un icono

1. Buscar primero un nombre adecuado en `iconPaths`; reutilizarlo si representa la misma acción.
2. Dibujar sobre la cuadrícula de 24 × 24 siguiendo las especificaciones comunes.
3. Añadir sus trazados a `iconPaths` con un nombre semántico en inglés, por ejemplo `download`. El tipo se actualiza automáticamente.
4. Insertarlo mediante `<AppIcon name="nombre" />`, manteniendo los eventos y etiquetas del control.
5. Ejecutar `npm run build` y revisar en el navegador el icono junto a los existentes, en fondos claros y oscuros, con sus estados y a anchuras reducidas. Si afecta a un control del plano, comprobar su arrastre y la superposición con cotas.

Ejemplo de entrada en el catálogo:

```ts
plus: ['M12 4v16M4 12h16'],
```

## Excepciones de los controles del plano

Los iconos habituales mantienen 24 px, pero sus botones pueden ser mayores para facilitar la interacción. No igualar el tamaño del dibujo y el área de interacción automáticamente.

- Los tiradores de tamaño conservan botones compactos de 11 × 11 px y el icono `resize` escalado a ese tamaño. Usan relleno claro y borde oscuro para mantener el cuadrado visible sobre la escena.
- La elevación usa el icono triangular `lift` de 24 px dentro de su control de 40 px.
- Los giros usan `AppIcon` con `name="rotate"` y el `path` proyectado del eje. El trazado original está en una cuadrícula de 40 unidades y el componente lo convierte a 24 mediante `scale(.6)`, compensando el grosor para conservar un trazo final de 2 unidades. Los marcadores de flecha tienen identificadores únicos por instancia. Conservar esta proyección: indica el plano de giro y acompaña al movimiento de la cámara.

Las líneas de cota, contornos de selección, aros de giro y miniaturas de objetos son representaciones geométricas. Mantienen sus propios SVG y no se incorporan al catálogo de iconos de interfaz.
