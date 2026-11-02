# Publicar el código y entregar

La autorización del usuario permite publicar este proyecto, pero hacen falta una cuenta accesible y URLs reales. Esta guía no significa que ya se haya publicado.

Desde la carpeta del proyecto, ejecutar en PowerShell:

```powershell
node --test
git status --short
```

Revisar que no se incluyan credenciales, datos locales ni archivos ajenos. Si todavía no existe repositorio Git, inicializarlo y crear el commit con los archivos revisados:

```powershell
git init
git add README.md CODEX_BUILD_LOG.md CODEX_HANDOFF_PROMPT.md LICENSE package.json .gitignore .env.example server.js public tests submission
git commit -m 'Build PARALLAX paired futures and Butterfly Lens'
```

Si la CLI `gh` está instalada y autenticada, puede crear y publicar el repositorio del usuario:

```powershell
gh auth status
gh repo create parallax-twitch-hackathon --public --source=. --remote=origin --push
```

Si el repositorio ya existe, usar su remoto real y el flujo de push correspondiente. También se puede crear en [GitHub](https://github.com/new). El jurado debe poder acceder al código e instrucciones. Si se elige privado, compartirlo con la cuenta indicada en las bases.

Subir el vídeo a YouTube Public (Unlisted está expresamente aceptado en el update oficial), verificar reproducción sin sesión y añadir URL real en Devpost. Confirmar el ID del hilo principal de Codex. Copiar la candidatura EN, completar campos y enviar en [Devpost](https://twitchcon-codex.devpost.com/) antes de las **22:00 Canarias del 2 de noviembre**. Comprobar **Submitted** en My Projects.

No inventar URLs ni dar por publicado un repositorio local. Después del cierre, conservar repo, vídeo y enlaces sin cambios hasta anunciarse ganadores, según el [recordatorio oficial](https://twitchcon-codex.devpost.com/updates/47341-final-weekend-make-your-project-come-alive).
