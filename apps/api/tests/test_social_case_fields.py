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
