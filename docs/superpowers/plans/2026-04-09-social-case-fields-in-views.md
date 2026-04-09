# Social Case Fields in Kanban & Table Views — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar nombre, cédula y foto del ciudadano en las tarjetas Kanban y filas de tabla de la vista de Casos, extrayendo los datos del `description_html` al guardar el issue en Django y exponiéndolos como campos de primer nivel en la API de lista.

**Architecture:** Se agregan tres campos (`social_case_nombre`, `social_case_cedula`, `social_case_foto_url`) al modelo Django `Issue`. El método `save()` los extrae del `description_html` usando un parser HTML a nivel de módulo. Los campos se exponen en el endpoint de lista via `grouper.py` y los serializers. En el frontend, la tarjeta Kanban y la fila de tabla los consumen directamente desde el store de issues.

**Tech Stack:** Django 4.2, Python `html.parser`, PostgreSQL migrations, TypeScript, React 18, MobX, Tailwind CSS.

---

## File Map

| Archivo | Acción | Responsabilidad |
|---------|--------|----------------|
| `apps/api/plane/db/models/issue.py` | Modificar | Agregar campos + parser a nivel módulo + extracción en `save()` |
| `apps/api/plane/db/migrations/0122_issue_social_case_fields.py` | Crear | Migración para los tres nuevos campos |
| `apps/api/plane/utils/grouper.py` | Modificar | Exponer los tres campos en el endpoint de lista |
| `apps/api/plane/app/serializers/issue.py` | Modificar | Agregar campos a `IssueSerializer`, `IssueDetailSerializer`, `IssueListDetailSerializer` |
| `apps/api/plane/management/__init__.py` | Crear | Inicializar paquete management |
| `apps/api/plane/management/commands/__init__.py` | Crear | Inicializar paquete commands |
| `apps/api/plane/management/commands/backfill_social_case_fields.py` | Crear | Backfill de issues existentes |
| `apps/api/tests/test_social_case_fields.py` | Crear | Tests del parser y del save() |
| `packages/types/src/issues/issue.ts` | Modificar | Agregar tres campos opcionales a `TBaseIssue` |
| `apps/web/core/components/issues/issue-layouts/kanban/block.tsx` | Modificar | Bloque ciudadano en tarjeta Kanban |
| `apps/web/core/components/issues/issue-layouts/spreadsheet/issue-row.tsx` | Modificar | Columna ciudadano en tabla |

---

## Task 1: Parser HTML a nivel de módulo en `issue.py`

**Files:**
- Modify: `apps/api/plane/db/models/issue.py:1-27` (sección de imports)

- [ ] **Step 1: Agregar imports y clase `_SocialCaseParser` al inicio del módulo**

Después de la línea 19 (`from plane.utils.html_processor import strip_tags`), agregar:

```python
# Social case parser — extracts citizen data from description_html
import json as _json
from html.parser import HTMLParser as _HTMLParser


class _SocialCaseParser(_HTMLParser):
    """Extrae nombre, cedula y foto_url del description_html de un caso social.

    Busca:
    - <caption> con JSON del data-social-case table → nombre, cedula
    - <img data-profile-photo="1"> → foto_url (ignora data: URIs)
    """

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_caption = False
        self.caption_text = ""
        self.foto_url = ""
        self.social_data = None

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == "caption":
            self.in_caption = True
        if tag == "img" and attrs_dict.get("data-profile-photo") == "1":
            src = attrs_dict.get("src", "")
            # Ignorar data: URIs — no sobreviven al sanitizador nh3 y son URLs de blob temporales
            if src and not src.startswith("data:"):
                self.foto_url = src

    def handle_endtag(self, tag):
        if tag == "caption":
            self.in_caption = False
            try:
                self.social_data = _json.loads(self.caption_text)
            except Exception:
                pass

    def handle_data(self, data):
        if self.in_caption:
            self.caption_text += data
```

- [ ] **Step 2: Verificar que el archivo compila sin errores**

```bash
cd apps/api && python -c "from plane.db.models.issue import _SocialCaseParser; print('OK')"
```

Expected: `OK`

---

## Task 2: Nuevos campos en el modelo `Issue`

**Files:**
- Modify: `apps/api/plane/db/models/issue.py:136-170` (definición de campos del modelo)

- [ ] **Step 1: Agregar los tres campos al modelo**

Después de la línea 137 (`description_stripped = models.TextField(blank=True, null=True)`), agregar:

```python
    # Social case fields — auto-populated from description_html on save()
    social_case_nombre = models.TextField(blank=True, default="")
    social_case_cedula = models.TextField(blank=True, default="")
    social_case_foto_url = models.CharField(max_length=2048, blank=True, default="")
```

- [ ] **Step 2: Verificar que el modelo carga**

```bash
cd apps/api && python -c "from plane.db.models.issue import Issue; print([f.name for f in Issue._meta.get_fields() if 'social' in f.name])"
```

Expected: `['social_case_nombre', 'social_case_cedula', 'social_case_foto_url']`

---

## Task 3: Extracción en `save()`

**Files:**
- Modify: `apps/api/plane/db/models/issue.py:178-242` (método `save()`)

- [ ] **Step 1: Agregar extracción en la rama `_state.adding` (línea ~224, después de `description_stripped`)**

Después del bloque que asigna `self.description_stripped` en `_state.adding` (línea 224), agregar:

```python
                # Extract social case fields from description_html
                if self.description_html and self.description_html.strip() not in ("", "<p></p>"):
                    _parser = _SocialCaseParser()
                    _parser.feed(self.description_html)
                    if _parser.social_data:
                        self.social_case_nombre = _parser.social_data.get("nombre", "")
                        self.social_case_cedula = _parser.social_data.get("cedula", "")
                    if _parser.foto_url:
                        self.social_case_foto_url = _parser.foto_url
```

- [ ] **Step 2: Agregar extracción en la rama `else` (actualización, línea ~240, después de `description_stripped`)**

Después del bloque que asigna `self.description_stripped` en la rama `else` (línea 240), agregar:

```python
            # Extract social case fields from description_html
            if self.description_html and self.description_html.strip() not in ("", "<p></p>"):
                _parser = _SocialCaseParser()
                _parser.feed(self.description_html)
                if _parser.social_data:
                    self.social_case_nombre = _parser.social_data.get("nombre", "")
                    self.social_case_cedula = _parser.social_data.get("cedula", "")
                if _parser.foto_url:
                    self.social_case_foto_url = _parser.foto_url
```

---

## Task 4: Tests del parser y save()

**Files:**
- Create: `apps/api/tests/test_social_case_fields.py`

- [ ] **Step 1: Crear archivo de tests**

```python
"""Tests for social case field extraction from description_html."""
import pytest
from plane.db.models.issue import _SocialCaseParser


SAMPLE_DESCRIPTION_HTML = """
<table data-social-case="1">
  <caption style="display:none">{"nombre":"Maria Gonzalez","cedula":"V-12345678","telefono":"","direccion":"","parroquia":"","municipio":"","entidad":"","jornada":"","referencia":"","accionTomada":"","resultado":"","numeroCaso":"042"}</caption>
  <tbody>
    <tr><td data-key="nombre">Nombre</td><td>Maria Gonzalez</td></tr>
    <tr><td data-key="cedula">Cedula</td><td>V-12345678</td></tr>
  </tbody>
</table>
<img data-profile-photo="1" src="/api/users/abc/avatar/" style="display:none" alt="profile-photo" />
<p>Descripcion del caso</p>
"""

DESCRIPTION_WITHOUT_SOCIAL = "<p>Simple issue description</p>"
DESCRIPTION_WITH_DATA_URI = """
<table data-social-case="1">
  <caption style="display:none">{"nombre":"Juan Perez","cedula":"V-99999999","telefono":"","direccion":"","parroquia":"","municipio":"","entidad":"","jornada":"","referencia":"","accionTomada":"","resultado":"","numeroCaso":"001"}</caption>
  <tbody></tbody>
</table>
<img data-profile-photo="1" src="data:image/jpeg;base64,/9j/abc123" style="display:none" alt="profile-photo" />
"""


class TestSocialCaseParser:
    def test_extracts_nombre_from_caption_json(self):
        parser = _SocialCaseParser()
        parser.feed(SAMPLE_DESCRIPTION_HTML)
        assert parser.social_data is not None
        assert parser.social_data["nombre"] == "Maria Gonzalez"

    def test_extracts_cedula_from_caption_json(self):
        parser = _SocialCaseParser()
        parser.feed(SAMPLE_DESCRIPTION_HTML)
        assert parser.social_data["cedula"] == "V-12345678"

    def test_extracts_foto_url(self):
        parser = _SocialCaseParser()
        parser.feed(SAMPLE_DESCRIPTION_HTML)
        assert parser.foto_url == "/api/users/abc/avatar/"

    def test_ignores_data_uri_foto(self):
        parser = _SocialCaseParser()
        parser.feed(DESCRIPTION_WITH_DATA_URI)
        assert parser.foto_url == ""

    def test_still_extracts_nombre_when_foto_is_data_uri(self):
        parser = _SocialCaseParser()
        parser.feed(DESCRIPTION_WITH_DATA_URI)
        assert parser.social_data["nombre"] == "Juan Perez"

    def test_returns_none_social_data_when_no_table(self):
        parser = _SocialCaseParser()
        parser.feed(DESCRIPTION_WITHOUT_SOCIAL)
        assert parser.social_data is None

    def test_returns_empty_foto_when_no_img(self):
        parser = _SocialCaseParser()
        parser.feed(DESCRIPTION_WITHOUT_SOCIAL)
        assert parser.foto_url == ""

    def test_handles_empty_string(self):
        parser = _SocialCaseParser()
        parser.feed("")
        assert parser.social_data is None
        assert parser.foto_url == ""

    def test_handles_malformed_caption_json(self):
        parser = _SocialCaseParser()
        parser.feed('<table data-social-case="1"><caption>not json</caption></table>')
        assert parser.social_data is None
```

- [ ] **Step 2: Ejecutar los tests**

```bash
cd apps/api && python -m pytest tests/test_social_case_fields.py -v
```

Expected: Todos los tests pasan (`9 passed`).

- [ ] **Step 3: Commit**

```bash
git add apps/api/plane/db/models/issue.py apps/api/tests/test_social_case_fields.py
git commit -m "feat: add social case fields to Issue model with auto-extraction in save()"
```

---

## Task 5: Migración Django

**Files:**
- Create: `apps/api/plane/db/migrations/0122_issue_social_case_fields.py`

- [ ] **Step 1: Generar la migración**

```bash
cd apps/api && python manage.py makemigrations --name issue_social_case_fields
```

Expected: `Migrations for 'db': plane/db/migrations/0122_issue_social_case_fields.py`

- [ ] **Step 2: Verificar el contenido de la migración generada**

Confirmar que el archivo creado contiene las tres operaciones `AddField` para `social_case_nombre`, `social_case_cedula` y `social_case_foto_url` sobre el modelo `Issue`.

- [ ] **Step 3: Aplicar la migración localmente**

```bash
cd apps/api && python manage.py migrate
```

Expected: `Applying db.0122_issue_social_case_fields... OK`

- [ ] **Step 4: Commit**

```bash
git add apps/api/plane/db/migrations/0122_issue_social_case_fields.py
git commit -m "chore: migration 0122 — add social_case_nombre/cedula/foto_url to Issue"
```

---

## Task 6: Exponer campos en `grouper.py`

**Files:**
- Modify: `apps/api/plane/utils/grouper.py:106-131`

- [ ] **Step 1: Agregar los tres campos a `required_fields`**

En `grouper.py`, dentro de `required_fields` (línea 106), después de `"description_html"` (línea 130), agregar:

```python
        "social_case_nombre",
        "social_case_cedula",
        "social_case_foto_url",
```

El bloque queda:
```python
    required_fields: List[str] = [
        ...
        "description_html",
        "social_case_nombre",
        "social_case_cedula",
        "social_case_foto_url",
    ]
```

- [ ] **Step 2: Verificar sintaxis**

```bash
cd apps/api && python -c "from plane.utils.grouper import issue_on_results; print('OK')"
```

Expected: `OK`

---

## Task 7: Actualizar serializers

**Files:**
- Modify: `apps/api/plane/app/serializers/issue.py:776-803` (IssueSerializer.Meta.fields)
- Modify: `apps/api/plane/app/serializers/issue.py:925-936` (IssueDetailSerializer)
- Modify: `apps/api/plane/app/serializers/issue.py:831-861` (IssueListDetailSerializer.to_representation)

- [ ] **Step 1: Agregar campos a `IssueSerializer.Meta.fields` (línea ~801)**

En `IssueSerializer.Meta.fields`, después de `"archived_at"` (línea 801), agregar:

```python
            "social_case_nombre",
            "social_case_cedula",
            "social_case_foto_url",
```

- [ ] **Step 2: Agregar campos a `IssueDetailSerializer` (línea ~931)**

En `IssueDetailSerializer.Meta.fields`, el `fields` hereda de `IssueSerializer.Meta.fields + [...]`. Los tres campos ya quedan incluidos por la herencia del step anterior. Solo verificar que no están duplicados.

- [ ] **Step 3: Agregar campos a `IssueListDetailSerializer.to_representation()` (línea ~860)**

En el dict `data` de `to_representation`, después de `"description_html": instance.description_html,` (línea 860), agregar:

```python
            "social_case_nombre": instance.social_case_nombre,
            "social_case_cedula": instance.social_case_cedula,
            "social_case_foto_url": instance.social_case_foto_url,
```

- [ ] **Step 4: Verificar que los serializers importan y cargan**

```bash
cd apps/api && python -c "from plane.app.serializers.issue import IssueSerializer, IssueDetailSerializer, IssueListDetailSerializer; print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add apps/api/plane/utils/grouper.py apps/api/plane/app/serializers/issue.py
git commit -m "feat: expose social_case_nombre/cedula/foto_url in issue list and detail API"
```

---

## Task 8: Management command para backfill

**Files:**
- Create: `apps/api/plane/management/__init__.py`
- Create: `apps/api/plane/management/commands/__init__.py`
- Create: `apps/api/plane/management/commands/backfill_social_case_fields.py`

- [ ] **Step 1: Crear estructura de directorios y archivos `__init__.py`**

```bash
mkdir -p apps/api/plane/management/commands
touch apps/api/plane/management/__init__.py
touch apps/api/plane/management/commands/__init__.py
```

- [ ] **Step 2: Crear el management command**

```python
# apps/api/plane/management/commands/backfill_social_case_fields.py
"""
Backfill social_case_nombre, social_case_cedula, social_case_foto_url
for existing issues that were created before the migration.

Usage:
    python manage.py backfill_social_case_fields
    python manage.py backfill_social_case_fields --dry-run
"""

from django.core.management.base import BaseCommand
from plane.db.models.issue import Issue, _SocialCaseParser


class Command(BaseCommand):
    help = "Backfill social case fields (nombre, cedula, foto_url) for existing issues."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview what would be updated without making changes.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        qs = Issue.objects.exclude(description_html="").exclude(description_html="<p></p>")
        total = qs.count()
        self.stdout.write(f"Processing {total} issues with non-empty description_html...")

        updated = 0
        for issue in qs.iterator(chunk_size=500):
            parser = _SocialCaseParser()
            parser.feed(issue.description_html)

            update = {}
            if parser.social_data:
                nombre = parser.social_data.get("nombre", "")
                cedula = parser.social_data.get("cedula", "")
                if nombre and issue.social_case_nombre != nombre:
                    update["social_case_nombre"] = nombre
                if cedula and issue.social_case_cedula != cedula:
                    update["social_case_cedula"] = cedula
            if parser.foto_url and issue.social_case_foto_url != parser.foto_url:
                update["social_case_foto_url"] = parser.foto_url

            if update:
                if not dry_run:
                    # Use .update() to avoid triggering save() recursively
                    Issue.objects.filter(pk=issue.pk).update(**update)
                updated += 1
                if dry_run:
                    self.stdout.write(f"  [dry-run] Would update issue {issue.id}: {list(update.keys())}")

        verb = "Would update" if dry_run else "Updated"
        self.stdout.write(self.style.SUCCESS(f"{verb} {updated} issues out of {total}."))
```

- [ ] **Step 3: Probar el comando en modo dry-run**

```bash
cd apps/api && python manage.py backfill_social_case_fields --dry-run
```

Expected: Sin errores. Muestra lista de issues que serían actualizados (o `Updated 0 issues` si no hay datos aún).

- [ ] **Step 4: Commit**

```bash
git add apps/api/plane/management/
git commit -m "feat: add backfill_social_case_fields management command"
```

---

## Task 9: Tipos TypeScript

**Files:**
- Modify: `packages/types/src/issues/issue.ts:45-80` (TBaseIssue)

- [ ] **Step 1: Agregar los tres campos opcionales a `TBaseIssue`**

En `TBaseIssue` (línea 45), después de `is_epic?: boolean;` (línea 78) y antes del cierre `};` (línea 80), agregar:

```typescript
  // Social case fields — populated server-side from description_html
  social_case_nombre?: string | null;
  social_case_cedula?: string | null;
  social_case_foto_url?: string | null;
```

- [ ] **Step 2: Verificar que el tipo compila**

```bash
cd packages/types && pnpm tsc --noEmit
```

Expected: Sin errores.

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/issues/issue.ts
git commit -m "feat: add social_case_nombre/cedula/foto_url to TBaseIssue type"
```

---

## Task 10: Tarjeta Kanban — bloque ciudadano

**Files:**
- Modify: `apps/web/core/components/issues/issue-layouts/kanban/block.tsx:100-153` (KanbanIssueDetailsBlock)

- [ ] **Step 1: Agregar import de `getFileURL`**

Al inicio de `block.tsx`, verificar si `getFileURL` ya está importado. Si no:

```typescript
import { cn, generateWorkItemLink, getFileURL } from "@plane/utils";
```

(Reemplaza la línea existente del import de `@plane/utils` para agregar `getFileURL`.)

- [ ] **Step 2: Insertar el bloque ciudadano en `KanbanIssueDetailsBlock`**

En el JSX de `KanbanIssueDetailsBlock`, entre el `<div className="relative">` del `IssueIdentifier` (línea ~102) y el `<Tooltip>` del nombre del issue (línea ~127), insertar:

```tsx
      {/* Social case citizen block */}
      {(issue.social_case_foto_url || issue.social_case_nombre) && (
        <div className="flex items-start gap-2 mt-1 mb-0.5">
          {issue.social_case_foto_url && (
            <img
              src={getFileURL(issue.social_case_foto_url) ?? ""}
              alt={issue.social_case_nombre ?? ""}
              className="h-9 w-9 flex-shrink-0 rounded-md border border-subtle object-cover"
            />
          )}
          {issue.social_case_nombre && (
            <p className="truncate pt-0.5 text-xs text-secondary">{issue.social_case_nombre}</p>
          )}
        </div>
      )}
```

El orden final del JSX en `KanbanIssueDetailsBlock` debe ser:
1. `<div className="relative">` — IssueIdentifier + menú
2. **Bloque ciudadano** (nuevo)
3. `<Tooltip>` — nombre del issue
4. `<IssueProperties>` — propiedades
5. `IssueStats` — sub-issues (si aplica)

- [ ] **Step 3: Verificar que el componente compila**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | grep "block.tsx"
```

Expected: Sin errores relacionados con `block.tsx`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/core/components/issues/issue-layouts/kanban/block.tsx
git commit -m "feat: show citizen photo and name in Kanban card"
```

---

## Task 11: Vista Tabla — columna ciudadano

**Files:**
- Modify: `apps/web/core/components/issues/issue-layouts/spreadsheet/issue-row.tsx:260-388` (IssueRowDetails JSX)

- [ ] **Step 1: Verificar import de `getFileURL` en `issue-row.tsx`**

Al inicio de `issue-row.tsx`, verificar si `getFileURL` está importado desde `@plane/utils`. Si no, agregarlo:

```typescript
import { cn, generateWorkItemLink, getFileURL } from "@plane/utils";
```

- [ ] **Step 2: Insertar la columna ciudadano en `IssueRowDetails`**

En el JSX de `IssueRowDetails`, justo después del cierre del primer `<td>` sticky (que termina en `</ControlLink></td>` alrededor de la línea 388), antes del bloque `{spreadsheetColumnsList.map(...)}`, insertar:

```tsx
      {/* Columna ciudadano — visible cuando el caso tiene datos del ciudadano */}
      {(issueDetail.social_case_nombre || issueDetail.social_case_foto_url) && (
        <td className="border-b-[0.5px] border-r-[0.5px] border-subtle-1 bg-surface-1 min-w-[200px] max-w-[280px]">
          <div className="flex h-11 items-center gap-2 px-3">
            {issueDetail.social_case_foto_url && (
              <img
                src={getFileURL(issueDetail.social_case_foto_url) ?? ""}
                alt={issueDetail.social_case_nombre ?? ""}
                className="h-7 w-7 flex-shrink-0 rounded-md border border-subtle object-cover"
              />
            )}
            <div className="min-w-0 truncate">
              {issueDetail.social_case_nombre && (
                <p className="truncate text-xs text-primary">{issueDetail.social_case_nombre}</p>
              )}
              {issueDetail.social_case_cedula && (
                <p className="truncate text-xs text-tertiary">{issueDetail.social_case_cedula}</p>
              )}
            </div>
          </div>
        </td>
      )}
```

- [ ] **Step 3: Verificar que el componente compila**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | grep "issue-row.tsx"
```

Expected: Sin errores relacionados con `issue-row.tsx`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/core/components/issues/issue-layouts/spreadsheet/issue-row.tsx
git commit -m "feat: show citizen photo, name and cedula in spreadsheet table view"
```

---

## Task 12: Verificación end-to-end

- [ ] **Step 1: Levantar el entorno de desarrollo**

```bash
# En la raíz del proyecto
docker-compose -f docker-compose-local.yml up -d
```

- [ ] **Step 2: Ejecutar el backfill sobre datos existentes**

```bash
docker-compose exec api python manage.py backfill_social_case_fields
```

Expected: `Updated N issues out of M.`

- [ ] **Step 3: Verificar respuesta de la API de lista**

```bash
curl -s -H "Authorization: Bearer <TOKEN>" \
  "http://localhost/api/v1/workspaces/<SLUG>/projects/<PROJECT_ID>/issues/?per_page=5" \
  | python -m json.tool | grep "social_case"
```

Expected: Los campos `social_case_nombre`, `social_case_cedula`, `social_case_foto_url` aparecen en la respuesta.

- [ ] **Step 4: Abrir la vista Kanban y verificar visualmente**

Navegar a `http://localhost/[workspace]/projects/[project]/issues/?layout=board` y confirmar:
- Los casos con ficha de ciudadano muestran la foto cuadrada y el nombre
- Los casos sin ficha se ven exactamente igual que antes

- [ ] **Step 5: Abrir la vista Tabla y verificar visualmente**

Navegar a `http://localhost/[workspace]/projects/[project]/issues/?layout=spreadsheet` y confirmar:
- Los casos con ficha muestran columna con foto + nombre + cédula
- Los casos sin ficha no muestran columna extra

- [ ] **Step 6: Crear un caso nuevo con ficha y verificar que aparece sin recargar**

Crear un issue nuevo con datos de ciudadano y verificar que la tarjeta/fila ya muestra los datos del ciudadano al volver a la vista de lista.

- [ ] **Step 7: Commit final**

```bash
git add .
git commit -m "chore: verify social case fields end-to-end"
```
