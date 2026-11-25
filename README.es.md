# sidepanel

Un panel lateral en vivo para [Claude Code](https://code.claude.com). Mientras Claude trabaja, el panel al
costado de la conversación muestra qué archivos está leyendo y editando, los comandos que corre, tu
repositorio y rama, cuánto contexto y uso te queda, y el disco, la RAM y la CPU de tu máquina.

[English](README.md)

```
SESIÓN
Opus 5.5
repo octocat/demo rama main
2 sin subir · 3 archivos sin commit
Contexto ▓░░░░░░░░░ 13%
5 horas  ▓░░░░░░░░░ 6% hasta 21:00
Semana   ▓▓▓▓▓▓▓▓▓░ 86% hasta lun 00:00
Sesión 23 min · ~US$ 2,05 a precio de lista

AHORA
Editando ~/demo/src/app.ts

ARCHIVOS DE ESTA SESIÓN
~/demo/src
  ✎ app.ts
  · utils.ts
~/demo
  + CHANGELOG.md
+ creado  ✎ editado  · leído  ⌕ búsqueda

COMANDOS
$ npm test
$ git status

SISTEMA
Disco ▓▓▓▓▓▓▓▓▓░ 26 GB libres de 245
RAM   ▓▓▓▓▓▓▓░░░ 5,9 de 8 GB
CPU   ▓▓░░░░░░░░ 18%
```

Las barras se ponen amarillas desde el 50 % y rojas desde el 80 %.

## Instalación

En una sesión de Claude Code en la terminal:

```
/plugin install sidepanel --marketplace henrylucenarincon/sidepanel
```

Respondé `y` para agregar el marketplace y elegí el alcance (el de usuario lo carga en todas las
sesiones).

Desde la terminal:

```
claude plugin install sidepanel --marketplace henrylucenarincon/sidepanel
```

En la app de escritorio: tocá **+** al lado del cuadro de texto, después **Plugins**, **Add
marketplace** con `henrylucenarincon/sidepanel` y **Add plugin**.

## Para pasarlo a español

En `/config`, poné la opción `language` de sidepanel en `es`. También se puede elegir al instalarlo.

## Uso

El panel se ve al costado de la conversación en la vista de pantalla completa. Se activa una sola
vez con:

```
/tui fullscreen
```

Se abre solo en una terminal de 144 columnas o más. En una más angosta (desde 110 columnas), se
abre con `/sidepanel`.

## Qué corre en tu máquina

sidepanel no se conecta a internet ni escribe archivos. Cada 5 segundos corre estos comandos
locales, que sólo leen:

- `git --no-optional-locks status --porcelain=v2 --branch` en la carpeta de la sesión. Nunca hace
  fetch ni toma el bloqueo del índice de git, así que no choca con otro trabajo en el repo.
- `df`, `sysctl -n hw.memsize`, `vm_stat` y `top`, para la sección del sistema (sólo macOS).

El modelo, el contexto, los límites de uso y el costo los da Claude Code, por su API de plugins.

Las claves y tokens dentro de un comando (un encabezado de `curl`, un `export`) se tapan con el
mecanismo de Claude Code antes de que el panel guarde o muestre el comando. Es lo mejor posible, no
una garantía: el panel igual muestra rutas y comandos, así que miralo antes de compartir una captura.

## Requisitos

- Claude Code 2.1.287 o posterior (probado en 2.1.331).
- La sección del sistema funciona en macOS. En Linux y Windows el panel anda sin ella.

## Licencia

[MIT](LICENSE) © 2026 Henry Lucena

sidepanel es un proyecto independiente. No lo hace, avala ni mantiene Anthropic.
