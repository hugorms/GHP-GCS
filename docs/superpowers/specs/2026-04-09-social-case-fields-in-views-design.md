# Spec: Datos del ciudadano en vistas Kanban y Tabla

**Fecha:** 2026-04-09  
**Estado:** Aprobado  
**Autor:** Rosmer (via brainstorming session)

---

## Contexto

El proyecto GHP-GCS es una plataforma de gestión de casos sociales construida sobre Plane. Cada issue representa un "Caso" y contiene una ficha del ciudadano (nombre, cédula, foto) embebida en el `description_html` mediante una tabla con `data-social-case="1"` y una imagen con `data-profile-photo="1"`.

Actualmente, las vistas Kanban y Tabla (Spreadsheet) no muestran ningún dato del ciudadano porque `description_html` no se incluye en la respuesta del API de lista de issues. El objetivo es mostrar la foto, nombre y cédula del ciudadano directamente en las tarjetas Kanban y en las filas de la tabla.

---

## Objetivo

Mostrar en las vistas de lista (Kanban y Tabla) los datos del ciudadano asociado a cada caso:
- **Vista Kanban:** foto cuadrada + nombre del caso + nombre del ciudadano
- **Vista Tabla:** columna "Ciudadano" con foto + nombre + cédula

---

## Decisiones de diseño

### Por qué campos en el modelo (no SerializerMethodField ni fetch lazy)

- Los datos están disponibles en la respuesta de lista sin requests adicionales
- Los campos son indexables y filtrables desde PostgreSQL en el futuro
- La extracción se hace una sola vez en `save()`, no en cada request
- Sin latencia visual ni skeletons en las tarjetas

### Extracción en `save()` del modelo Issue

El método `save()` ya procesa `description_html` para extraer `description_stripped`. Se agrega la misma lógica para extraer los datos del ciudadano usando el parser de Python (`html.parser`) sobre la tabla `data-social-case="1"` y el tag `data-profile-photo="1"`.

---

## Cambios requeridos

### 1. Backend — Modelo `Issue`

**Archivo:** `apps/api/plane/db/models/issue.py`

**Tres nuevos campos** al final del modelo. `foto_url` usa `CharField` con `max_length` acotado:

```python
social_case_nombre   = models.TextField(blank=True, default="")
social_case_cedula   = models.TextField(blank=True, default="")
social_case_foto_url = models.CharField(max_length=2048, blank=True, default="")
```

**Parser a nivel de módulo** (fuera de la clase `Issue`, junto a los imports existentes):

```python
# Al inicio del módulo, junto a los otros imports
import json as _json
from html.parser import HTMLParser as _HTMLParser

class _SocialCaseParser(_HTMLParser):
    """Extrae nombre, cedula y foto_url del description_html de un caso social."""

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
            # Ignorar data: URIs — no sobrevivirán al sanitizador nh3
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

En el método `save()`, **solo cuando `description_html` tiene contenido**, tras la extracción de `description_stripped`:

```python
# Extraer datos del ciudadano — solo si hay description_html
if self.description_html and self.description_html.strip() not in ("", "<p></p>"):
    parser = _SocialCaseParser()
    parser.feed(self.description_html)
    if parser.social_data:
        self.social_case_nombre = parser.social_data.get("nombre", "")
        self.social_case_cedula = parser.social_data.get("cedula", "")
    if parser.foto_url:
        self.social_case_foto_url = parser.foto_url
```

### 2. Backend — Migración Django

**Archivo:** `apps/api/plane/db/migrations/XXXX_issue_social_case_fields.py`

Migración generada con `makemigrations` que agrega los tres campos al modelo Issue.

### 3. Backend — `grouper.py`

**Archivo:** `apps/api/plane/utils/grouper.py`

Agregar los tres campos a `required_fields`:

```python
"social_case_nombre",
"social_case_cedula",
"social_case_foto_url",
```

### 4. Backend — Serializer

**Archivo:** `apps/api/plane/app/serializers/issue.py`

Tres cambios:

1. Agregar los tres campos a `IssueSerializer.Meta.fields` (son `read_only_fields` automáticamente por `read_only_fields = fields`).
2. Agregar los tres campos a `IssueDetailSerializer` (extiende `IssueSerializer`).
3. Agregar los tres campos explícitamente al dict de `IssueListDetailSerializer.to_representation()` — esta clase tiene un `to_representation` manual que no hereda de `IssueSerializer.Meta.fields`.

### 5. TypeScript — Tipos

**Archivo:** `packages/types/src/issues/issue.ts`

Agregar a `TBaseIssue`:

```typescript
social_case_nombre?: string | null;
social_case_cedula?: string | null;
social_case_foto_url?: string | null;
```

### 6. Frontend — Tarjeta Kanban

**Archivo:** `apps/web/core/components/issues/issue-layouts/kanban/block.tsx`

En `KanbanIssueDetailsBlock`, entre el `IssueIdentifier` y el `Tooltip` del nombre, insertar el bloque del ciudadano condicionado a que existan datos:

```tsx
{(issue.social_case_foto_url || issue.social_case_nombre) && (
  <div className="flex items-start gap-2 mt-1 mb-0.5">
    {issue.social_case_foto_url && (
      <img
        src={getFileURL(issue.social_case_foto_url) ?? ""}
        alt={issue.social_case_nombre ?? ""}
        className="h-9 w-9 rounded-md object-cover flex-shrink-0 border border-subtle"
      />
    )}
    {issue.social_case_nombre && (
      <p className="text-xs text-secondary truncate pt-0.5">{issue.social_case_nombre}</p>
    )}
  </div>
)}
```

**Nota:** `getFileURL` devuelve `undefined` cuando `path` es falsy. La guarda `issue.social_case_foto_url &&` garantiza que `getFileURL` recibe un string no-vacío, pero se agrega `?? ""` para satisfacer el tipo `string` requerido en el atributo `src`.

**Layout final de la tarjeta:**
```
┌─────────────────────────────────────┐
│ CSS-042                         ⋯  │
│ ┌──────┐  Solicitud de atención     │
│ │ foto │  médica urgente para...    │
│ └──────┘  María González Pérez      │
│ 🔴 Alta   📅 15 Abr                 │
└─────────────────────────────────────┘
```

- Foto: cuadrada `h-9 w-9` (36×36px), `rounded-md`, `object-cover`
- Nombre del ciudadano: `text-xs text-secondary` debajo del título
- El bloque solo se renderiza si hay `social_case_foto_url` o `social_case_nombre`
- La foto sola se renderiza si hay `social_case_foto_url`
- El nombre solo se renderiza si hay `social_case_nombre`

### 7. Frontend — Vista Tabla (Spreadsheet)

**Archivo:** `apps/web/core/components/issues/issue-layouts/spreadsheet/issue-row.tsx`

En `IssueRowDetails`, después de la primera columna sticky (nombre del caso), agregar una segunda columna sticky "Ciudadano":

La columna ciudadano se implementa como una `<td>` **no sticky** (columna regular, no fija) para evitar la complejidad de calcular dinámicamente el offset `left` de una segunda columna sticky (que depende de `displayProperties.key`, nesting level y tamaño de pantalla). Se inserta después del primer `<td>` sticky del nombre.

```tsx
{(issueDetail.social_case_nombre || issueDetail.social_case_foto_url) && (
  <td className="bg-surface-1 border-r-[0.5px] border-b-[0.5px] border-subtle-1 min-w-[200px]">
    <div className="flex items-center gap-2 px-3 h-11">
      {issueDetail.social_case_foto_url && (
        <img
          src={getFileURL(issueDetail.social_case_foto_url) ?? ""}
          alt={issueDetail.social_case_nombre ?? ""}
          className="h-7 w-7 rounded-md object-cover flex-shrink-0 border border-subtle"
        />
      )}
      <div className="min-w-0 truncate">
        {issueDetail.social_case_nombre && (
          <p className="text-xs text-primary truncate">{issueDetail.social_case_nombre}</p>
        )}
        {issueDetail.social_case_cedula && (
          <p className="text-xs text-tertiary truncate">{issueDetail.social_case_cedula}</p>
        )}
      </div>
    </div>
  </td>
)}
```

**Nota arquitectónica:** No se usa `sticky` para esta columna. El offset izquierdo dinámico requeriría un `ResizeObserver` o un valor fijo que rompería sub-issues y vistas con la columna `key` oculta. La columna regular es la solución correcta para esta fase.

---

## Comportamiento cuando no hay datos

- **Kanban:** La tarjeta se ve exactamente igual que hoy. Sin espacio extra, sin placeholders.
- **Tabla:** La columna "Ciudadano" no se renderiza en la fila. No se muestra columna vacía.

---

## Flujo de datos

```
Usuario llena SocialCaseForm
        ↓
Frontend → injectSocialCaseIntoHtml() + injectProfilePhotoIntoHtml()
        ↓
PATCH /api/v1/.../issues/{id}/ con description_html actualizado
        ↓
Issue.save() → _SocialCaseParser extrae nombre, cedula, foto_url
        ↓
social_case_nombre / social_case_cedula / social_case_foto_url guardados en DB
        ↓
GET /api/v1/.../issues/ → grouper.py incluye los 3 campos en la respuesta
        ↓
Frontend Kanban / Tabla → muestra datos sin fetch adicional
```

---

## Casos límite

| Caso | Comportamiento |
|------|---------------|
| Issue sin ficha social | Los tres campos quedan `""`. Kanban y tabla no muestran bloque ciudadano. |
| Ficha con nombre pero sin foto | Se muestra nombre sin imagen en ambas vistas. |
| Ficha con foto pero sin nombre | Se muestra solo la imagen. |
| URL de foto relativa (`/api/...`) | `getFileURL()` la convierte a URL absoluta con `API_BASE_URL`. |
| URL de foto absoluta | `getFileURL()` la devuelve tal cual. |
| description_html malformado | El parser falla silenciosamente; los campos quedan con su valor anterior. |
| Issue existente antes de la migración | Los campos quedan `""`. Se actualizan la próxima vez que se guarde el issue. |

---

## Archivos afectados

| Archivo | Tipo de cambio |
|---------|---------------|
| `apps/api/plane/db/models/issue.py` | Nuevos campos + extracción en save() |
| `apps/api/plane/db/migrations/XXXX_issue_social_case_fields.py` | Nueva migración |
| `apps/api/plane/utils/grouper.py` | Agregar 3 campos a required_fields |
| `apps/api/plane/app/serializers/issue.py` | Agregar 3 campos a IssueSerializer, IssueDetailSerializer e IssueListDetailSerializer.to_representation() |
| `packages/types/src/issues/issue.ts` | Agregar 3 campos opcionales a TBaseIssue |
| `apps/web/core/components/issues/issue-layouts/kanban/block.tsx` | Bloque ciudadano en tarjeta |
| `apps/web/core/components/issues/issue-layouts/spreadsheet/issue-row.tsx` | Columna ciudadano en tabla |
| `apps/api/plane/management/commands/backfill_social_case_fields.py` | Management command para backfill de issues existentes |

---

## Backfill de issues existentes

Los issues creados antes de la migración tendrán los tres campos vacíos. Se requiere un **management command** de Django para backfill:

```python
# management/commands/backfill_social_case_fields.py
for issue in Issue.objects.exclude(description_html="").exclude(description_html="<p></p>"):
    parser = _SocialCaseParser()
    parser.feed(issue.description_html)
    update = {}
    if parser.social_data:
        update["social_case_nombre"] = parser.social_data.get("nombre", "")
        update["social_case_cedula"] = parser.social_data.get("cedula", "")
    if parser.foto_url:
        update["social_case_foto_url"] = parser.foto_url
    if update:
        Issue.objects.filter(pk=issue.pk).update(**update)  # update() evita disparar save() recursivamente
```

El command se ejecuta manualmente post-deploy: `python manage.py backfill_social_case_fields`.

---

## Lo que NO cambia

- El flujo de creación/edición de la ficha social (`SocialCaseForm`) no se modifica.
- La extracción de datos en el frontend (`extractFromHtml`, `extractProfilePhotoFromHtml`) se mantiene para la vista de detalle.
- No se agregan endpoints nuevos.
- No se modifica el schema del editor de descripción.
